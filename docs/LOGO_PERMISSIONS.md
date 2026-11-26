# Logo permission requests (Get help)

Status: working document for the product owner (W4, 2026-11-26). Not a policy: it is kept out of
`docs/legal/` so it is not published in the app or on the sales site.

The owner would like each support organisation's official logo on the Get help page, to make it
easier to recognise. Logos are trademarks. We add one only when the organisation's own published
guidance clearly allows this kind of use (a link to its service from a family app), or when it has
given written permission. Until then the page shows a neutral icon and the organisation's exact
name.

## Findings (checked on each organisation's own site, 2026-11-26)

No organisation's own site clearly permits this use. Every guidance page found says a logo needs
prior permission, or says nothing about logos. So **no logo is added yet**. Every service shows
the neutral icon.

| Service (id in `content/support/uk-services.json`)                     | What the official site says                                                                                                                                                                                                                                                                                                                                                                                 | Source                                                                                                    | Outcome                                                         |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Childline (`childline`), Report Remove (`report-remove`)               | "All rights reserved; no part of this website, including information, images, photos, logos, names and icons may be copied, republished, posted, broadcast or reproduced in any form whatsoever without the prior written permission of the copyright holders." "The Childline logos are the trademarks of the NSPCC."                                                                                      | https://www.childline.org.uk/legal/terms-and-conditions/                                                  | Permission needed (ask the NSPCC)                               |
| NSPCC Helpline (`nspcc-helpline`)                                      | "No part of this site, including information, documents, images, photos, logos, names, audio, video and icons may be copied, republished, posted, broadcast or reproduced in any form whatsoever without the prior written permission of the copyright holders." The press office offers a logo that "allows you to clearly state your relationship with us on your press materials", which is not our use. | https://www.nspcc.org.uk/terms-conditions/ and https://www.nspcc.org.uk/about-us/contact-us/press-office/ | Permission needed                                               |
| Samaritans (`samaritans`)                                              | "The names and logos of Samaritans and all related product and service names, designs marks and slogans are the trade names, service marks or trade marks of Samaritans and may not be used without the prior consent of Samaritans." Also: "any links created to the Website are notified to and approved by Samaritans before they are created."                                                          | https://www.samaritans.org/legal/                                                                         | Permission needed. **Also notify them of our link** (see below) |
| Shout (`shout`), The Mix (`the-mix`)                                   | No logo or brand guidance found. The pages checked (Get help, Contact us, Privacy centre) only say "© Copyright Mental Health Innovations 2026".                                                                                                                                                                                                                                                            | https://giveusashout.org/privacy/ and https://www.themix.org.uk/about-us/privacy-centre/                  | Unclear, so ask                                                 |
| YoungMinds (`youngminds`)                                              | No logo or brand guidance found on the media centre page.                                                                                                                                                                                                                                                                                                                                                   | https://www.youngminds.org.uk/about-us/media-centre/                                                      | Unclear, so ask                                                 |
| Kooth (`kooth`)                                                        | No guidance could be read: the terms page loads its text with scripts, and nothing was visible in the build environment.                                                                                                                                                                                                                                                                                    | https://www.kooth.com/terms-and-conditions                                                                | Unclear, so ask                                                 |
| Beat (`beat`)                                                          | No logo or brand guidance found on the media centre page.                                                                                                                                                                                                                                                                                                                                                   | https://www.beateatingdisorders.org.uk/media-centre/                                                      | Unclear, so ask                                                 |
| FRANK (`frank`)                                                        | "You must not copy or use the FRANK logo without obtaining permission in writing from FRANK@dhsc.gov.uk."                                                                                                                                                                                                                                                                                                   | https://www.talktofrank.com/terms-conditions                                                              | Permission needed (FRANK@dhsc.gov.uk)                           |
| CEOP (`ceop`)                                                          | "The images, audio, NCA and CEOP logos on this website are, unless otherwise stated, NCA copyright. No other images on this site may be reproduced in any format other than for fair comment (e.g. screen shots used for illustration in a presentation) unless permission is granted by the NCA press office. Requests should be submitted to: digitalcommunications@nca.gov.uk."                          | https://www.ceop.police.uk/Safety-Centre/Terms-and-conditions/                                            | Permission needed (digitalcommunications@nca.gov.uk)            |
| Switchboard (`switchboard`)                                            | The Terms of Service page is about using the support line. It says nothing about logos.                                                                                                                                                                                                                                                                                                                     | https://switchboard.lgbt/terms-of-service                                                                 | Unclear, so ask                                                 |
| Brook (`brook`)                                                        | "If you wish to use the Brook logo to link back to our website or one of our subdomains, please contact us on website@brook.org.uk for permission. When using our logo, it must be made clear that you are linking to us and not affiliated with us." Also: "You must not link to this website using inline linking (also known as hotlinking …)".                                                          | https://www.brook.org.uk/content-and-linking-policy/                                                      | Permission needed (website@brook.org.uk)                        |
| Victim Support (`victim-support`)                                      | "You may not download, reproduce, store in a retrieval system or transmit by any means any parts of this site (including images, documents, audio or videos) for any purpose other than for personal, non-commercial use, without our prior written consent."                                                                                                                                               | https://www.victimsupport.org.uk/terms-and-conditions/                                                    | Permission needed                                               |
| NHS 111 (`nhs-111`), Emergency services 999 (`emergency-999`)          | The NHS website's open licence does not cover "any logos, visuals, image rights, trademarks, trade names and design styles … of the NHS website". It also says: "You need written permission from us or any other owner of NHS Website Content before you may use these items in any other way." 999 has no single logo; it stays with the neutral icon.                                                    | https://www.nhs.uk/our-policies/terms-and-conditions/                                                     | Permission needed for NHS 111; 999 keeps the neutral icon       |
| Coram Kidscape (`coram-kidscape`, `coram-kidscape-parent-advice-line`) | Not checked: `coramkidscape.org.uk` is not reachable from the build environment.                                                                                                                                                                                                                                                                                                                            | (blocked)                                                                                                 | Ask, or check by hand                                           |
| Anti-Bullying Alliance (`anti-bullying-alliance`)                      | Not checked: the site shows a bot check that the build environment cannot pass.                                                                                                                                                                                                                                                                                                                             | (blocked)                                                                                                 | Ask, or check by hand                                           |

### Samaritans: linking

Samaritans' terms ask that links to their website are "notified to and approved by Samaritans
before they are created". The Get help page already links to samaritans.org. The request below
for Samaritans therefore also notifies them of the link and asks for approval. This is for the
owner to decide; nothing in the app changes until they do.

## How to add a logo once permission is given

1. Save the logo file the organisation supplies, or the one its guidance names, as an optimised
   SVG or PNG under `apps/web/public/support-logos/`. Never hot-link it.
2. Record next to it: the organisation, the guidance or permission quote, its URL or the date of
   the written permission, and any conditions (size, colours, clear space, "not affiliated"
   wording).
3. Do not alter or recolour it beyond what the guidance allows. Its alt text is the
   organisation's exact name.
4. Update this table, add the logo through a schema change in
   `content/schemas/support-services.schema.json` (the schema rejects unknown fields today), and
   keep the e2e test that the page makes no third-party requests passing.

## Email template (for the owner to send as the business owner)

Placeholders in `{{…}}` are filled in by the owner. No personal data is kept in this repository.

> **Subject:** Permission to show your logo on a free family revision app's support page
>
> Hello,
>
> I run {{APP_NAME}}, a small revision app for UK secondary school students and their parents. It
> has a private "Get help" page that lists UK support services, including {{SERVICE_NAME}}. The
> page shows what each service helps with and how to contact it, copied from your official
> website, with a link to your site. The page records nothing about who opens it, and it works
> offline.
>
> To help young people recognise services they trust, we would like to show your logo next to
> your name on that page. We would:
>
> - use a copy of the logo you supply or approve, stored in our app (not loaded from your site);
> - show it only next to your service's name and official contact details, linking to your
>   website;
> - not change its colours or shape, and follow any brand guidelines you send;
> - make clear that we link to you and are not affiliated with or endorsed by you;
> - remove it promptly if you ask.
>   {{SAMARITANS_ONLY: Your terms ask that links to your website are notified to you first. Our
>   page links to https://www.samaritans.org/ and to your contact page; please let us know if you
>   approve.}}
>
> Could you tell us whether this is acceptable, and send any logo file and guidelines we should
> use? If you would rather we did not show the logo, we will keep showing your name only.
>
> Thank you for the work you do.
>
> {{SENDER_NAME}}
> {{APP_NAME}}
> {{CONTACT_EMAIL}}

### Where to send it (from each organisation's own site)

- FRANK: FRANK@dhsc.gov.uk (from https://www.talktofrank.com/terms-conditions)
- CEOP (National Crime Agency): digitalcommunications@nca.gov.uk (from
  https://www.ceop.police.uk/Safety-Centre/Terms-and-conditions/)
- Brook: website@brook.org.uk (from https://www.brook.org.uk/content-and-linking-policy/)
- NSPCC (also Childline and Report Remove): through the press office page,
  https://www.nspcc.org.uk/about-us/contact-us/press-office/
- Samaritans, Victim Support, Shout and The Mix (Mental Health Innovations), YoungMinds, Kooth,
  Beat, Switchboard, NHS 111, Coram Kidscape, Anti-Bullying Alliance: through the contact page on
  each organisation's own website. No logo-request address was found on the pages checked.
