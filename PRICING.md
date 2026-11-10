# Pricing rule — minimum 35% margin per item (applies to every product, now and going forward)

**Margin** = profit ÷ revenue, where revenue = item price + shipping charged to the customer.

## Formula
```
landed   = supplier unit cost (upper tier) + inbound freight per unit
mail     = USPS Ground Advantage RETAIL price for the item's weight, at the WORST zone in the shipping region
fees     = Shopify Payments 2.9% of revenue + $0.30
Required revenue  R >= (landed + mail + 0.30) / 0.621      # 1 - 0.35 - 0.029 = 0.621
Item price        = R - region shipping charge, rounded UP to the next .99
Final price       = the highest result across Central, East and West
```

## Worst USPS zones from origin ZIP 437 (Zanesville, OH)
| Shopify region | States | Worst zone |
|---|---|---|
| Central | TX OK KS NE SD ND MN IA MO AR LA MS AL TN KY IL IN WI MI OH | 7 (TX); Alabama is 4–5 |
| East | ME→FL incl. DC | 6 (FL) |
| West | MT WY CO NM AZ UT ID NV WA OR CA | 8 (AZ ID NV WA OR CA) |

Current shipping charges (0–1 lb / 1–2 lb): Central $4.99 / $6.49, East $5.99 / $7.49, West $6.49 / $7.99.

## Checks before a price goes live
1. If inbound freight is unknown, use a **$4.00/unit conservative buffer** and label it as an estimate.
2. MOQ items: price from per-unit cost, but note the up-front MOQ cash risk.
3. If the 35% price is more than ~1.5× the typical Amazon/Walmart price (or above every comparable found),
   **do not set it** — flag it and source dropship-direct (supplier ships to the customer, no USPS retail reship), then re-run the formula.
4. If only the West fails, prefer a modest West shipping-rate increase over a higher national price.
5. Never set a compare-at price lower than the price.

Script: `shopify-setup/pricing.py` (box workspace) implements the formula. Last run: 2026-11-09.
