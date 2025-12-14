module typee::game {
    use iota::object::{Self, UID};
    use iota::transfer;
    use iota::tx_context::{Self, TxContext};

    // Struct untuk menyimpan hasil typing test
    public struct Score has key, store {
        id: UID,
        wpm: u64,
        accuracy: u64,
    }

    // Fungsi yang akan dipanggil dari Frontend (Next.js)
    public entry fun mint_score(
        wpm: u64, 
        accuracy: u64, 
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // Cetak NFT (Object) Score
        let score_nft = Score {
            id: object::new(ctx),
            wpm,
            accuracy
        };

        // Transfer NFT tersebut ke dompet user (Sender)
        transfer::public_transfer(score_nft, sender);
    }
}