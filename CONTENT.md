# Content guide

These are the rules every guide follows, whether a person or Claude writes it.

## Who it's for
Someone in the UK who just searched "how to iron on a patch", "how to fix a hole in jeans", "how to darn a jumper", "best glue for patches" or similar. The site covers patches **and** everyday clothing repair and mending. Answer their question in the first paragraph.

## Shape of a how-to guide
1. A short opening: the quick answer, and what usually goes wrong.
2. What you need, or what to check first (usually the fabric care label).
3. The method, as numbered steps.
4. A table: problems and fixes, methods compared, or types compared.
5. A "Don't" list.
6. `## Common questions`: 3 to 5 questions people actually search, each as a `### Question?` heading followed by a short answer. The build turns these into FAQ data for Google, so keep that exact heading.
7. `## The short version`: two or three sentences.

## Rules
- Accuracy first. Base steps on manufacturer instructions and established sewing practice. Never invent statistics, test results, temperatures for specific products, or prices. Where products differ, say "follow the instructions that came with it".
- Safety: always tell readers to check the care label before using heat, never to iron PVC or rubber patches, and to ventilate when using solvent glues.
- Written for **UK readers**: British spelling (colour, centre, favourite), metric first with imperial in brackets (60 cm (2 ft)), UK terms (washing-up liquid, tumble dryer, baking paper, trainers), °C only for wash temperatures.
- Plain language, short paragraphs. **800–1,300 words**.
- Front matter: every guide also needs `patch:` (its embroidered patch label, up to two short words split by `|`, e.g. `SEW|IT ON`) and `shape:` (circle, square, hex, oval or shield). Vary the shape from neighbouring guides.
- Front matter: `date` and `reviewed` are both today's date for a new guide. When you meaningfully update an old guide, set `reviewed` to today.
- Photo (optional): add `image:` (an Unsplash photo id such as `photo-1511275539165-cc46b1ee89bf`) and `imageAlt:` to the front matter. Find one with WebFetch on `https://unsplash.com/s/photos/<words>?license=free`, pick a free photo (images.unsplash.com, never plus.unsplash.com) whose description matches, and don't reuse one another guide uses. If nothing fits, leave both out and the topic illustration is shown.
- No filler intros, no "In conclusion", no keyword stuffing.
- One topic per guide. Check `content/guides/` first and don't duplicate an existing guide; update it instead.
- Link to 1–3 related guides on the site with relative links like `/guides/how-to-iron-on-a-patch/`.
- `category` must be one of: Applying patches, Mending and repairs, Patch care, Choosing patches, Projects and ideas, Tools and kit.
- Where a guide is about placing patches, link to the free [patch layout tool](/patch-layout-tool/).

## Buying guides (Tools and kit)
Buying guides help someone choose a product: "best X for patches". They are where most affiliate income comes from. Shape:
1. A short opening: why it matters and the quick answer.
2. `## What to look for`.
3. A table of the main types: Type / Best for / What to know / Shop, with an Amazon link per type.
4. `## Popular picks`: 3 to 6 **specific products** (one per type), as bullets: `- **Exact product name.** One plain sentence on what it is and who it suits. [Check price on Amazon](amazon:exact product name)`. Only long-established products from well-known brands that several independent review sites recommend (search the web to check); never invent a product. Open with: "These are popular, widely recommended examples of each type... We haven't tested them ourselves, so check the reviews and instructions on Amazon before you buy."
5. How to use it, as numbered steps.
6. `## What to avoid`.
7. `## Common questions` and `## The short version`.

Rules for buying guides:
- **Never claim we tested or own a product**, and never invent reviews, star ratings, prices or awards.
- After publishing, add a section to `content/pages/best-patch-supplies.md` (a sentence, a link to the guide, and a Type / Best for / Popular pick table).

## Affiliate links
- Only add links from programs listed in `AFFILIATES.md`, and only where a product genuinely fits the advice.
- **Amazon:** write `[See fabric glues](amazon:textile glue washable)`. The build turns it into an amazon.co.uk search link with our tag, marks it `rel="sponsored nofollow"`, and adds the affiliate notice at the top of the page. If no tag is set yet, the link text shows without a link. Don't hand-write Amazon URLs.
- 1 to 3 Amazon links in a how-to guide. In a buying guide, one per type in the table plus one per named product in Popular picks.

## Topic backlog
Write these next, roughly in order, and remove each from the list once published. Alternate mending guides with patch guides.

Mending and repairs (category: Mending and repairs; buying guides go in Tools and kit):
- Buying guide: best sewing machines for beginners (UK)
- How to fix a broken zip (stuck, split and missing teeth)
- How to take up trousers by hand (hemming without a machine)
- How to fix a ripped seam
- How to remove bobbles from a jumper (and stop them coming back)
- Buying guide: best fabric shavers and de-bobblers
- How to darn socks
- How to fix a hole in a T-shirt
- How to mend a hole in a coat lining
- How to fix a snag in a jumper
- Buying guide: best darning and mending kits
- How to replace a drawstring in a hoodie or joggers
- How to fix a fallen hem with hemming tape (no sewing)
- How to repair a tear in a waterproof jacket
- Basic hand stitches every mender needs

Patches:
- Buying guide: best sewing kits for patches and repairs
- Embroidered vs woven vs PVC patches: what's the difference?
- How to make your own iron-on patch (fusible web method)
- Buying guide: best needles and thread for sewing on patches
- How to put a patch on a leather jacket
- How to attach patches to a nylon or polyester jacket
- How to make embroidered patches with an embroidery machine
- Buying guide: best beginner embroidery machines (UK)
- How to put patches on trainers and canvas shoes
- Velcro patches: how to add a hook-and-loop panel
- How to design a custom patch (sizes, colours, borders)
- Chenille patches: how to apply and care for them
- Buying guide: best heat press mats and Teflon sheets
- How to arrange lots of patches on a jacket (battle jacket guide)
- Scout and Guide badges: how to sew them on neatly
- How to put a name patch on school uniform
