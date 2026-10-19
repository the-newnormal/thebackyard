// The Terms and Conditions at /terms, word for word from "Backyard SG — Terms
// and Conditions". Wrap words in **double asterisks** to bold them and
// *single asterisks* to italicise them; email addresses become links.
// Update `dated` whenever the wording changes.

/** A bulleted list item, with a list of its own if it has one. */
type TermsItem = string | { text: string; items: string[] };

/** A paragraph, or a bulleted list. */
export type TermsBlock = string | TermsItem[];

export type TermsSection = { heading: string; blocks: TermsBlock[] };

const dated = "Effective date: 18 October 2026 · Last updated: 18 October 2026";

export const terms = {
  title: "Backyard SG — Terms and Conditions",
  updated: "18 October 2026",
  about: {
    heading: "About these Terms",
    blocks: [
      "These Terms apply to your registration for, attendance at, and participation in Backyard, and to your use of any Backyard sign-up page or website. They have two parts:",
      [
        "**Part A — Terms and Conditions of Participation**",
        "**Part B — Data Protection Notice**",
      ],
      "By registering, entering the event venue, or otherwise participating in Backyard, you confirm that you have read, understood and agree to be bound by both parts.",
      "In these Terms, **“Backyard SG”**, **“Backyard”**, **“we”**, **“us”** or **“our”** refers to Backyard SG, the organiser of Backyard. **“You”** or **“your”** refers to any participant, volunteer, co-creation contributor, community member, visitor, or their parent or legal guardian where the participant is under 18.",
      "**“Affiliated Parties”** means organisations we work with to organise, host, fund, support or deliver Backyard, including co-organisers, venue owners and operators, community and programme partners, funders, sponsors, and our service providers.",
    ],
  } satisfies TermsSection,
  parts: [
    {
      id: "participation",
      title: "Part A — Terms and Conditions of Participation",
      intro: [],
      sections: [
        {
          heading: "1. Acceptance of these Terms",
          blocks: [
            "**1.1** These Terms govern your participation in Backyard and your use of any Backyard sign-up page or website. By registering, entering the event venue, or participating in any Backyard activity, you agree to these Terms.",
            "**1.2** If you do not agree to these Terms, you must not register for or attend the event.",
            "**1.3** We may update these Terms from time to time. The version in force is the one published at the time of your registration or attendance. Your continued participation constitutes acceptance of the current Terms.",
          ],
        },
        {
          heading: "2. Eligibility and registration",
          blocks: [
            "**2.1** Backyard is a community event open to members of the public within our intended participant profile. We may set eligibility conditions for specific activities and communicate these at registration.",
            "**2.2 Participants under 18.** If you are under 18, you may only register and attend with the consent of your parent or legal guardian. By allowing a person under 18 to register or attend, the parent or legal guardian agrees to these Terms on that person’s behalf and accepts responsibility for that person’s conduct and welfare at the event, save to the extent that any loss or injury is caused by our negligence. We may require proof of guardian consent and may refuse admission where it is not provided.",
            "**2.3** You must provide accurate, current and complete information when you register, and keep your registration details up to date.",
            "**2.4** Registration is personal to you and, unless we state otherwise, may not be transferred or resold. We may refuse, cancel or revoke any registration at our discretion, including where these Terms have been or are likely to be breached.",
          ],
        },
        {
          heading: "3. Admission, conduct and security",
          blocks: [
            "**3.1** Admission is subject to available capacity and to compliance with these Terms, the rules of the event venue, the directions of our crew, staff and security personnel, and all applicable laws of Singapore.",
            "**3.2** You agree to conduct yourself responsibly and with respect for other participants, our crew, venue staff and members of the public. The following are prohibited at the event:",
            [
              "violence, or threatening, abusive, harassing or discriminatory behaviour;",
              "possession or use of weapons, illegal drugs or other unlawful items;",
              "attendance while intoxicated, or consumption of alcohol or controlled substances in breach of venue rules or the law;",
              "damage to, or interference with, the venue, equipment or property of others;",
              "any conduct that is unsafe, disruptive, or that we reasonably consider may bring the event into disrepute.",
            ],
            "**3.3** For the safety of all attendees, we and the venue may carry out bag checks and security screening as a condition of entry. You may be refused entry if you decline to comply.",
            "**3.4** We may refuse entry to, or remove from the venue, any person who breaches these Terms or who we reasonably consider poses a risk to the safety or enjoyment of others. No refund (where a fee or contribution has been paid) will be due in these circumstances.",
          ],
        },
        {
          heading: "4. Assumption of risk",
          blocks: [
            "**4.1** Your attendance and participation are entirely voluntary.",
            "**4.2** You acknowledge that attending a live public event carries inherent risks, which may include, without limitation: crowds and crowd movement; slips, trips and falls; burns and other injuries from hot food, grills and open flames; physical and interactive activities; contact or interaction with other participants and members of the public; and the consumption of food and beverages prepared by us and our volunteers.",
            "**4.3** To the extent that any such risk is not caused by our negligence or breach of duty, you voluntarily accept and assume that risk. Nothing in this clause 4 excludes or limits our liability where clause 6.1 applies.",
          ],
        },
        {
          heading: "5. Food, allergies, health and medical matters",
          blocks: [
            "**5.1** All food and beverages at Backyard are prepared and served by us and our volunteers in a non-commercial setting, not by a licensed food establishment. We take reasonable care in preparing and handling food, but do not warrant that any food or beverage is suitable for every attendee.",
            "**5.2** If you have any allergy, intolerance or dietary requirement, you are responsible for checking the suitability of any food or beverage before consuming it, and for disclosing relevant requirements where our registration process invites you to. We do not warrant that any food or beverage is free from allergens.",
            "**5.3** By attending, you confirm that you are medically fit to participate in the activities you choose to take part in. You are responsible for managing your own medical conditions and bringing any medication you require.",
            "**5.4** First aid or medical standby may be available at the event. In a medical emergency, you consent to us arranging first aid or emergency medical assistance on your behalf where you are unable to do so yourself. Any resulting medical or ambulance costs are your responsibility.",
            "**5.5** Food is prepared on shared equipment and in the same space as common allergens, including peanuts, tree nuts, shellfish, fish, eggs, milk, wheat/gluten, soy and sesame. Cross-contact cannot be ruled out, even for dishes that do not contain these ingredients.",
            "**5.6** Unless clearly labelled otherwise, food and beverages at Backyard are not halal-certified. Any vegetarian or other dietary labels are given in good faith but without guarantee.",
            "**5.7** Food is intended for consumption at the event during the serving period. We are not responsible for any food consumed after that period or taken off-site.",
            "**5.8** Outside food and beverages may be brought at your own risk, subject to venue rules. You must not share food containing common allergens with other attendees without telling them.",
          ],
        },
        {
          heading: "6. Limitation of liability",
          blocks: [
            "**6.1 Nothing in these Terms excludes or limits our liability for:**",
            [
              "**(a) death or personal injury caused by our negligence;**",
              "**(b) fraud or fraudulent misrepresentation; or**",
              "**(c) any other liability that cannot be excluded or limited under the laws of Singapore.**",
            ],
            "**6.2** Subject to clause 6.1, and to the fullest extent permitted by law, we shall not be liable to you for:",
            [
              "loss of, or damage to, your personal property, including items lost, stolen or damaged at the venue;",
              "loss, injury or damage arising from the acts or omissions of other participants, members of the public, or third parties such as vendors, performers, speakers, sponsors or the venue operator;",
              "any indirect, incidental or consequential loss;",
              "any loss or inconvenience arising from changes to, postponement or cancellation of the event, or from circumstances beyond our reasonable control as described in clause 9.",
            ],
            "**6.3** Subject to clause 6.1, and to the extent permitted and reasonable under the laws of Singapore, our total aggregate liability to you arising out of or in connection with your participation in Backyard shall not exceed the total fees (if any) you paid to us to attend.",
            "**6.4** You acknowledge that the allocation of risk in these Terms is reasonable given that Backyard is a community event and, where applicable, is provided free of charge or at low cost.",
          ],
        },
        {
          heading: "7. Indemnity",
          blocks: [
            "**7.1** You agree to indemnify us and keep us indemnified against any claims, liabilities, losses, damages, costs and expenses (including reasonable legal costs) that we suffer or incur arising out of or in connection with:",
            [
              "your breach of these Terms;",
              "your negligent, reckless or wilful acts or omissions;",
              "any damage you cause to the venue, equipment or the property of others; or",
              "your violation of any law or the rights of any third party.",
            ],
            "**7.2** This clause 7 does not require you to indemnify us against any liability arising from our own negligence or breach of duty.",
          ],
        },
        {
          heading: "8. Photography, recording and media",
          blocks: [
            "**8.1** Photography, videography and audio recording will take place at the event, as described in the Data Protection Notice in Part B. By entering the venue after notice has been displayed, you acknowledge and consent to being recorded and to our use of such recordings on the terms set out in Part B.",
            "**8.2** You may take photographs or recordings for your own personal, non-commercial use, provided you do not disrupt the event, endanger others, or infringe the privacy or rights of other attendees.",
          ],
        },
        {
          heading: "9. Changes, cancellation and force majeure",
          blocks: [
            "**9.1** The event programme, hosts, performers, timings, activities and venue are subject to change. We will use reasonable efforts to notify you of material changes, but are not obliged to do so in advance.",
            "**9.2** We may postpone, cancel, shorten or otherwise vary the event, in whole or in part, where we reasonably consider it necessary, including for reasons of safety, insufficient numbers, or events beyond our reasonable control.",
            "**9.3** We shall not be liable for any failure or delay in performing our obligations where it results from circumstances beyond our reasonable control, including without limitation acts of God, extreme weather, fire, flood, epidemic or pandemic, government action or public health directives, civil disturbance, terrorism, strikes, or failure of utilities, transport or venue facilities.",
          ],
        },
        {
          heading: "10. Intellectual property",
          blocks: [
            "**10.1** All Backyard branding, names, logos, materials, event content and website content are owned by or licensed to Backyard SG and are protected by applicable intellectual property laws.",
            "**10.2** You may not copy, reproduce, distribute or commercially exploit any such content without our prior written consent.",
          ],
        },
        {
          heading: "11. Third parties, vendors and links",
          blocks: [
            "**11.1** The event may feature goods, services, activities or content provided by third parties, and our pages may link to third-party websites. We do not control and are not responsible for the goods, services, content, acts or omissions of any third party. Your dealings with third parties are solely between you and that third party.",
          ],
        },
        {
          heading: "12. Governing law and jurisdiction",
          blocks: [
            "**12.1** These Terms and any dispute or claim arising out of or in connection with them or your participation in Backyard (including non-contractual disputes or claims) are governed by the laws of Singapore.",
            "**12.2** You agree to submit to the exclusive jurisdiction of the courts of Singapore.",
          ],
        },
        {
          heading: "13. General",
          blocks: [
            "**13.1 Severability.** If any provision of these Terms is found invalid or unenforceable, it shall be severed and the remaining provisions shall continue in full force and effect.",
            "**13.2 No waiver.** Our failure to enforce any provision of these Terms shall not constitute a waiver of that or any other provision.",
            "**13.3 Entire agreement.** These Terms, together with the Data Protection Notice in Part B and any notices or consent clauses we bring to your attention, constitute the entire agreement between you and us in relation to your participation in Backyard.",
            "**13.4 Contact.** Questions about these Terms may be sent to dpo@backyard.sg.",
          ],
        },
      ],
      dated,
    },
    {
      id: "data-protection",
      title: "Part B — Data Protection Notice",
      intro: [
        "This Data Protection Notice (“Notice”) sets out the basis on which Backyard SG, the organiser of Backyard (“Backyard SG”, “Backyard”, “we”, “us” or “our”), may collect, use, disclose or otherwise process personal data of our event participants, volunteers, community members and their authorised representatives in accordance with the Personal Data Protection Act 2012 (“PDPA”). It applies to personal data in our possession or under our control, including personal data held by our Affiliated Parties (as defined in these Terms) and by organisations we have engaged to collect, use, disclose or process personal data for our purposes.",
      ],
      sections: [
        {
          heading: "Personal data",
          blocks: [
            "**1.** “Personal data” means data, whether true or not, about an individual (whether a prospective participant, participant, volunteer, community member, authorised representative or otherwise) who can be identified: (a) from that data; or (b) from that data and other information to which we have or are likely to have access.",
            "**2.** Depending on how you interact with us, personal data we may collect includes your name; contact details such as email address or phone number; age or date of birth; school, organisation or community affiliation; your responses to our sign-up and co-creation forms (such as interests, skills and availability); emergency contact details; dietary or accessibility requirements you choose to disclose; social media handles; and photographs, video footage, audio recordings and other audio-visual information in which you may appear or be heard.",
            "**3.** Other terms used in this Notice have the meanings given to them in the PDPA (where the context permits).",
          ],
        },
        {
          heading: "Collection, use and disclosure of personal data",
          blocks: [
            "**4.** We generally do not collect your personal data unless (a) it is provided to us voluntarily by you directly, or via a third party duly authorised by you to disclose it to us (your “authorised representative”), after (i) you or your authorised representative have been notified of the purposes for which it is collected, and (ii) you or your authorised representative have consented to its collection and use for those purposes; or (b) collection and use without consent is permitted or required by the PDPA or other laws. We will seek your consent before collecting additional personal data, and before using your personal data for a purpose not notified to you (except where permitted or authorised by law).",
            "**5.** We may collect and use your personal data for any or all of the following purposes:",
            [
              {
                text: "**Establishing or managing your relationship with us**, including:",
                items: [
                  "*Participants:* registering you for and administering Backyard, including check-in, capacity planning, activity allocation, and safety and security at the event; and monitoring and evaluating our events and programmes, including gathering and analysing your feedback to improve future editions;",
                  "*Volunteers and co-creation contributors:* evaluating your suitability and availability to volunteer or contribute; and coordinating, monitoring and evaluating the activities you are involved in;",
                  "*Community members:* managing your membership of the Backyard community and our community channels;",
                ],
              },
              "providing you with information on our upcoming events or activities, where you have requested or agreed to receive it, and, unless you have opted out under clause 7, using your contact details so that we and our Affiliated Parties can send you information about events, programmes, products or services;",
              "creating, using and publishing photographs, video footage and audio recordings from our events for the purposes in clauses 8 to 10 below;",
              "verifying your identity;",
              "responding to and processing queries, requests, applications, complaints and feedback from you;",
              "complying with applicable laws, regulations, codes of practice, guidelines or rules, or assisting in law enforcement and investigations by any governmental or regulatory authority;",
              "any other purposes for which you have provided the information;",
              "transmitting to our Affiliated Parties and to unaffiliated third parties, including our service providers and agents and relevant governmental or regulatory authorities, in Singapore or abroad, for the above purposes; and",
              "any other incidental purposes related to or in connection with the above.",
            ],
            "**6.** We may disclose your personal data:",
            [
              "to our Affiliated Parties, who may access, use and disclose it for the purposes in clause 5, including organising, hosting, funding, evaluating and reporting on Backyard and related programmes;",
              "where required for, or in connection with, organising and running our events and community activities, including to the event venue where necessary for safety and security;",
              "to service providers, agents and other organisations we engage to carry out any purpose in clause 5, such as our website, form and communication platforms and our appointed photographers and videographers; and",
              "to comply with applicable laws, regulations, codes of practice, guidelines, rules or requests by public agencies, or to assist in law enforcement and investigations.",
            ],
            "**7.** We do not sell your personal data. Affiliated Parties may only use your personal data for the purposes in clause 5. By submitting the sign-up form, you consent to us and our Affiliated Parties using your contact details to send you information about events, programmes, products or services. This includes your clear and unambiguous consent, for the purposes of Part 9 of the PDPA, to receive such messages by text message (including instant messaging) at the Singapore telephone number you provide, and by email, whether or not that number is listed on the Do Not Call Registry. To opt out, you must email our Data Protection Officer at the address in clause 24 with the subject line “Marketing opt-out”. You may do so at any time, and once your request is processed under clause 12, we and our Affiliated Parties will stop using your contact details for marketing; you may also unsubscribe directly with any Affiliated Party that contacts you. Opting out does not affect your registration or admission. We will not disclose your contact details to any other event partner or sponsor for their own marketing without your consent.",
          ],
        },
        {
          heading: "Photography, videography and audio recording at events",
          blocks: [
            "**8.** Photography, videography and audio recording will take place at our events, by us and by parties we authorise. Notices will be displayed at the venue. By entering the venue after such notice, you acknowledge and consent that you may be photographed and recorded, and that these may be used by us and our Affiliated Parties for publicity and communications, including on our website and social media, in recap and report materials for partners and supporters, and in marketing for future events.",
            "**9.** If you prefer not to be photographed or filmed, tell any crew member or photographer at the event and we will make reasonable efforts to avoid featuring you.",
            "**10.** If a published photograph or recording features you and you want it removed, contact our Data Protection Officer at the details below, and we will take reasonable steps to remove it from channels within our control. Wide crowd shots may not allow every individual to be edited out, but we will not deliberately feature a person who has asked not to be featured.",
          ],
        },
        {
          heading: "Withdrawing your consent",
          blocks: [
            "**11.** Your consent remains valid until you or your authorised representative withdraw it in writing. You may withdraw consent and ask us to stop collecting, using or disclosing your personal data for any or all of the purposes above by emailing or writing to our Data Protection Officer. If you cannot submit your request in writing or need help doing so, you can ask to speak to our Data Protection Officer.",
            "**12.** On receiving your written request, we may need reasonable time (depending on its complexity and impact on our relationship with you) to process it and to tell you the consequences of acceding to it, including any legal consequences affecting your rights and liabilities to us. We generally aim to process requests within ten (10) business days.",
            "**13.** Depending on the nature and scope of your request, we may not be able to continue providing our services or admitting you to our events; we will tell you before completing the request. To cancel a withdrawal of consent, inform us in writing as described above.",
            "**14.** Withdrawing consent does not affect our right to continue collecting, using and disclosing personal data where this is permitted or required without consent under applicable laws.",
          ],
        },
        {
          heading: "Access to and correction of personal data",
          blocks: [
            "**15.** To request (a) access to a copy of the personal data we hold about you, or information about how we use or disclose it, or (b) correction or updating of that personal data, email or write to our Data Protection Officer. If you need help submitting your request, you can ask to speak to our Data Protection Officer.",
            "**16.** A reasonable fee may be charged for an access request. If so, we will tell you the fee before processing it.",
            "**17.** We will respond as soon as reasonably possible, generally within five (5) business days. If we cannot respond within thirty (30) days of receiving your request, we will tell you in writing within those thirty (30) days when we will be able to. If we cannot provide personal data or make a correction you requested, we will generally tell you why (except where the PDPA does not require us to).",
          ],
        },
        {
          heading: "Protection of personal data",
          blocks: [
            "**18.** To safeguard your personal data from unauthorised access, collection, use, disclosure, copying, modification, disposal or similar risks, we use appropriate administrative, physical and technical measures, such as minimised collection, authentication and access controls (including good password practices and need-to-know disclosure), reputable platforms with security controls, up-to-date software, and two-factor or multi-factor authentication on accounts holding personal data.",
            "**19.** No method of transmission over the Internet or electronic storage is completely secure. While security cannot be guaranteed, we strive to protect your information and continually review and improve our security measures.",
          ],
        },
        {
          heading: "Accuracy of personal data",
          blocks: [
            "**20.** We generally rely on personal data provided by you or your authorised representative. To keep it current, complete and accurate, please tell our Data Protection Officer of any changes.",
          ],
        },
        {
          heading: "Retention of personal data",
          blocks: [
            "**21.** We may retain your personal data for as long as necessary to fulfil the purpose for which it was collected, or as required or permitted by applicable laws.",
            "**22.** We will stop retaining your personal data, or remove the means by which it can be associated with you, once it is reasonable to assume retention no longer serves the purpose for which it was collected and is no longer necessary for legal or business purposes. Photographs and recordings used in our publicity may be kept in our event archive, subject to your right to request removal under clause 10.",
          ],
        },
        {
          heading: "Transfers of personal data outside Singapore",
          blocks: [
            "**23.** Some of our service providers and platforms (such as our website, form and communication platforms) store or process data on servers outside Singapore. Where your personal data is transferred outside Singapore, we will take steps to ensure it continues to receive a standard of protection at least comparable to that under the PDPA, including through our providers’ contractual commitments.",
          ],
        },
        {
          heading: "Data Protection Officer",
          blocks: [
            "**24.** Contact our Data Protection Officer with any enquiries or feedback on our personal data protection policies and procedures, or to make any request:",
            ["Email: dpo@backyard.sg"],
          ],
        },
        {
          heading: "Effect of Notice and changes to Notice",
          blocks: [
            "**25.** This Notice applies alongside any other notices, contractual clauses and consent clauses relating to our collection, use and disclosure of your personal data, including the Terms and Conditions of Participation in Part A.",
            "**26.** We may revise this Notice from time to time without prior notice. You can tell whether it has been revised by the date it was last updated. Your continued use of our services constitutes acknowledgement and acceptance of such changes.",
          ],
        },
      ],
      dated,
    },
  ] satisfies {
    id: string;
    title: string;
    intro: TermsBlock[];
    sections: TermsSection[];
    dated: string;
  }[],
};
