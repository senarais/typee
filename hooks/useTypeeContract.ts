import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useIotaClient } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";

// --- CONFIG ---
// PASTIKAN PACKAGE ID INI BENAR
const TESTNET_PACKAGE_ID = "0xc00e31b0d06c4774e4149b48153a327601c20d985fd5ab2529cc3fdb76bcef20"; 
const MODULE_NAME = "game";
const FUNCTION_NAME = "mint_score";
const STRUCT_TYPE = `${TESTNET_PACKAGE_ID}::${MODULE_NAME}::Score`;

export interface ScoreNFT {
    id: string;
    wpm: number;
    accuracy: number;
}

export const useTypeeContract = () => {
    const account = useCurrentAccount();
    const client = useIotaClient();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();

    // State
    const [isMinting, setIsMinting] = useState(false);
    const [mintedObjectId, setMintedObjectId] = useState("");
    const [lastTxDigest, setLastTxDigest] = useState("");
    
    const [historyData, setHistoryData] = useState<ScoreNFT[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // --- FUNCTION: MINT SCORE (REVISED - PIZZA STYLE) ---
    const mintScore = (wpm: number, acc: number, onSuccess?: () => void) => {
        if (!account) return;
        setIsMinting(true);
        setMintedObjectId(""); 

        const tx = new Transaction();
        tx.moveCall({
            target: `${TESTNET_PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
            arguments: [
                tx.pure.u64(wpm),
                tx.pure.u64(acc)
            ]
        });

        signAndExecute({
            transaction: tx,
            // Kita gak butuh options di sini lagi, kita bakal fetch manual
        }, {
            onSuccess: async (result) => {
                console.log("Tx Submitted, Waiting for confirmation...", result.digest);
                setLastTxDigest(result.digest);

                try {
                    // --- LOGIC PIZZA (ROBUST) ---
                    // Kita paksa tunggu sampe transaksi confirmed di network
                    const txResult = await client.waitForTransaction({
                        digest: result.digest,
                        options: {
                            showEffects: true, // Kita butuh effects buat liat object yg created
                        }
                    });

                    // Ambil Object ID dari array 'created'
                    // created[0].reference.objectId adalah standar IOTA/Sui
                    const createdObject = txResult.effects?.created?.[0];
                    const newId = createdObject?.reference?.objectId;

                    if (newId) {
                        console.log("Mint Confirmed! ID:", newId);
                        setMintedObjectId(newId);
                        setIsMinting(false); // Stop loading
                        if (onSuccess) onSuccess(); // Pindah screen
                    } else {
                        console.warn("Tx Success but no object created?");
                        setIsMinting(false);
                    }

                } catch (waitError) {
                    console.error("Error waiting for transaction:", waitError);
                    setIsMinting(false);
                    alert("Transaction sent but timed out waiting for confirmation.");
                }
            },
            onError: (err) => {
                console.error("Mint Failed:", err);
                setIsMinting(false);
            }
        });
    };

    // --- FUNCTION: FETCH HISTORY ---
    const fetchHistory = async () => {
        if (!account) return;
        setIsLoadingHistory(true);

        try {
            const objects = await client.getOwnedObjects({
                owner: account.address,
                filter: { StructType: STRUCT_TYPE },
                options: { showContent: true }
            });

            const parsedData: ScoreNFT[] = objects.data.map((obj) => {
                const content = obj.data?.content as any;
                const fields = content?.fields;
                return {
                    id: obj.data?.objectId || "",
                    wpm: Number(fields?.wpm || 0),
                    accuracy: Number(fields?.accuracy || 0)
                };
            });

            setHistoryData(parsedData);
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    return {
        isMinting,
        mintedObjectId,
        lastTxDigest,
        historyData,
        isLoadingHistory,
        isConnected: !!account,
        userAddress: account?.address,
        mintScore,
        fetchHistory
    };
};