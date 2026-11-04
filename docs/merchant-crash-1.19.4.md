# Merchant offer decoder correction

The protocol-762 decoder returned inputItem1/outputItem/inputItem2 and transport field names while NativeMerchantScreen and tradeCost require a/out/b/disabled/uses/max. Opening a populated offer list dereferenced undefined a.id.

The decoder now retains the shared internal offer shape while preserving the exact native 1.19.4 wire format: a VarInt-sized collection, three ItemStacks (including an empty second cost), disabled flag, uses, maximum uses, XP, special price, multiplier and demand. Verified against client.jar MerchantOffers (clh), createFromStream/writeToStream. The [Trading history](https://minecraft.wiki/w/Trading#History) provides release context; newer packet formats are not assumed.

Regression coverage decodes real packet bytes through Game.on_trade_list and the merchant background/hover paths, with absent/present second costs, discounted/demand-adjusted prices, exhausted trades and the opening frame before offers arrive.

Backport audit: existing 1.14.4–1.18.2 decoders already return the required shared field names and retain their native older wire format. 1.8.9/1.12.2/1.13.2 use the older merchant implementation. No changes to these formats were needed.
