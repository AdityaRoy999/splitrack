# UPI handle audit

Checked on 18 November 2026 against [NPCI's live UPI member directories](https://www.npci.org.in/product/upi/all-members), using the page's official spreadsheet exports for UPI 3rd Party Applications, UPI Bank Application, UPI PPI Applications, and UPI Applications Live on IPO.

`defaultHandle` is a suggestion, not a registered address. Users must enter the full UPI ID issued by their provider. Switching providers preserves the entered address; selecting a suffix explicitly changes it. Existing saved profiles are not migrated.

Wallet handles are marked separately because they refer to wallet-backed payment addresses. Several bank directory rows group related apps together; their published handles belong to that bank/app family. The suffix list does not restrict users from entering another valid full ID.

| App in SplitTrack | Suggested suffix | Other published suffixes | Wallet suffixes |
| --- | --- | --- | --- |
| Google Pay | @okaxis | @okhdfcbank, @okicici, @oksbi | — |
| PhonePe | @ybl | @ibl, @axl | @phonepe |
| Paytm | @ptyes | @ptaxis, @pthdfc, @ptsbi, @paytm | — |
| Slice UPI | @slc | — | — |
| CRED UPI | @axisb | @yescred | @cred |
| BHIM UPI | @upi | — | — |
| Amazon Pay | @apl | @yapl, @rapl | @amazonpay |
| Jupiter Money | @jupiteraxis | — | @jupiter |
| Fi Money | Full ID entry | — | — |
| Navi UPI | @naviaxis | @nyes | — |
| super.money | @superyes | — | — |
| MobiKwik | @ikwik | @mbkns | @mbk |
| Freecharge | @freecharge | — | — |
| Tata Neu UPI | @tapicici | @tnaxis | — |
| Groww Pay | @yesg | — | — |
| Zerodha Coin / Kite | Full ID entry | — | — |
| Bajaj Finserv UPI | @abfspay | — | @bpaywallet |
| CheQ UPI | @cqaxis | — | — |
| FamPay (FamApp) | @yesfam | — | @fam |
| Akudo | Full ID entry | — | — |
| Muvin Teen Pay | Full ID entry | — | — |
| PayZapp (HDFC) | @pz | — | @pzw |
| iMobile Pay (ICICI) | @icici | @imobile | — |
| YONO SBI | @sbi | @sbipay | — |
| Kotak 811 Mobile | @kotakbank | @kotak811, @kotak, @kaypay, @kotakpay | — |
| Axis Mobile (Open) | @axisbank | — | — |
| PNB One UPI | @pnb | @pnbcc, @pnbcorp | — |
| Canara ai1 | @cnrb | — | — |
| bob World (BOB) | @barodampay | @barodapay | — |
| IndusMobile (INDIE) | @indie | @indus, @induspay, @indusind, @drindus | — |
| Union Bank Vyom | @unionbank | @unionbankofindia, @uboi, @ubi, @andb, @corp | — |
| FedMobile | @federal | @fbl | — |
| IDFC FIRST Mobile | @idfcfirst | @idfcbank | — |
| YES Pay Next | @yespay | — | — |
| RBL MoBank | @rbl | @rblbank | — |
| Bandhan mBank | @bandhan | — | — |
| SIB Mirror+ (South Indian) | @sib | — | — |
| KVB DLite | @kvb | — | — |
| CUB mBank Plus | @cub | — | — |
| KBL Mobile Plus | @kbl | — | — |
| AU 0101 Mobile | @aubank | — | — |
| Equitas Mobile Banking | @equitas | @purz | — |
| digibank (DBS) | @dbs | — | — |
| Airtel Thanks UPI | @airtel | — | — |
| IPPB DakPay | @postbank | @ippb, @dakpay | — |
| Fino BPay | @finobank | @finopay | — |
| JioFinance / MyJio UPI | @jio | @jiopartner | — |
| WhatsApp Pay | @waicici | @waaxis, @wasbi, @wahdfcbank, @icici | — |
| Samsung Wallet / Pay | @pingpay | — | — |
| Zomato UPI | Full ID entry | — | — |
| Swiggy UPI | Full ID entry | — | — |
| Flipkart UPI | @fkaxis | — | — |
| Tata Pay | Full ID entry | — | — |
| Myntra UPI | Full ID entry | — | — |
| Nykaa Pay | Full ID entry | — | — |
| Ola Money Postpaid / UPI | Full ID entry | — | — |
| Uber UPI | Full ID entry | — | — |

No current app-specific receiving suffix was confirmed for Fi Money, Zerodha, Akudo, Muvin, Zomato, Swiggy, TataPay, Myntra, Nykaa, Ola Money, or Uber. Their earlier brand-name guesses have been removed; full ID entry remains available. A merchant accepting UPI is not sufficient evidence that it issues personal receiving IDs.

CheQ Digital's bank-backed app uses `@cqaxis`. The separately listed Cheq / Transcorp visitor wallet uses `@trans`; these are different products and are not merged into the same suggestion list.

The implementation uses the interoperable `upi://pay` format. Settlement requests include `am` rounded to two decimals and `cu=INR`; balances are stored in INR regardless of the display currency. Account QR codes without a particular debt remain amount-free. See [Google's UPI payment field reference](https://developers.google.com/pay/india/api/web/create-payment-method) and [slice's universal UPI intent example](https://developer.slicebank.com/payin/get-order-status/).

Generating or sharing a payment QR does not mark a debt settled. The payer approves the transfer in their UPI app; settlement recording remains an explicit action in SplitTrack.
