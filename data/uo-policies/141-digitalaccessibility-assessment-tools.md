# Tools | Digital Accessibility @ UO

Source: https://digitalaccessibility.uoregon.edu/assessment/tools
Fetched: 2026-10-27
Found from: https://teaching.uoregon.edu/guidance-making-your-syllabus-accessible

Tools
There are a variety of tools to assist you in performing an accessibility self-evaluation of your website or digital content.
Jump to a section:
Automated Scanners
Website Testing Tools DubBot
Editoria11y Accessibility Checker
Accessibility Insights
Color Contrast Tools
Screen Readers
Screen Magnifiers
Automated Scanners
While there are many automated scanners available to test websites and many products have built-in scanners (e.g., Microsoft Word and Adobe Acrobat), automated scanners can only detect a small percentage of accessibility issues and also produce false positives and false negatives . Some people find these tools to be helpful to double-check to make sure they didn't forget anything that the tools can detect, but manual testing is the only way to fully evaluate accessibility .
Automated testing tools can often detect the following types of issues:
Missing alternative text on images (but not whether alternative text is appropriate/correct!)
Missing captions on videos (but not whether the captions are accurate!)
Insufficient color contrast for solid-colored text against a solid-colored background that isn't an image of text
Some heading hierarchy issues on web pages
Tables missing headers on web pages
Form fields missing labels
Automated testing tools cannot reliably detect the following types of issues:
Anything to do with text or meaning (e.g., whether text should be a heading, whether a label is accurate, whether alternative text is appropriate, whether video captions are correct, whether instructions inappropriately reference purely sensory characteristics)
Color contrast of text on a picture or non-solid background, text in a video, or text inside an image
Images of text
Correct heading structure
Whether text can be resized without breaking things
Whether content can be accessed with a keyboard alone
...and most other accessibility violations
Some options:
For websites, DubBot and Editorially are available at UO, and are explained in the next section on this page.
For Canvas content, the university has PopeTech . You can learn more about it from Teaching Support and Innovation's PopeTech Accessibility Guide .
Microsoft Office products, like Word and PowerPoint, have an automated checker in the "Review" tab. In Adobe Acrobat , you can find an automated checker in the "Accessibility" section in the "Tools" tab.
Website Testing Tools
DubBot
UO licenses an enterprise-level service called DubBot to provide automated website accessibility evaluation and reporting.
Recommended Users
Web administrators
Web developers and designers
Advanced accessibility evaluators
Compliance roles
Benefits and Use
DubBot conducts automated accessibility tests on all pages on a website every week.
DubBot also performs automated scans for broken links, SEO, spell checking, web governance, and best practices.
DubBot provides both top-level reporting and results for individual pages.
Findings can be displayed and highlighted on a page to quickly locate and resolve issues.
DubBot provides detailed explanations of violations.
DubBot results for individual pages can be reached directly in Drupal via the "DubBot" tab. [Note: Drupal module must be installed and configured by a site administrator.]
Limitations
As an automated accessibility scanner , this tool is limited in what issues it can identify. As a rough guide, assume that this tool will only be able to find about 15% of the accessibility violations on a page or site, and the remaining 85% will require manual review . Common issues that automated tools can detect include whether an image is missing alternative text (but not whether the text is appropriate), whether headings are nested correctly (but not whether they are correctly tagged as headings, what the correct structure is, or whether the text is appropriate), and whether text contrast is insufficient (for certain types of text). Most other accessibility issues cannot be detected by automated scanners.
This tool cannot be relied on to determine whether a page is compliant with accessibility standards, though it can be helpful in locating problem pages and content and identifying certain types of violations.
DubBot scans each site every 7 days, and therefore cannot be used for evaluating live changes to a page/site (in contrast to Editoria11y ).
Sites and users must be added to DubBot by the Digital Accessibility Architect.
If you want to use the Drupal module, it must be installed and configured by a site administrator.
UO's license is limited to a maximum number of total pages that can be scanned across the entire university.
Help and Documentation
DubBot Learning Center
DubBot online documentation
How to Get Access
Contact ictaccess@uoregon.edu with the site(s) you want scanned by DubBot, a list of UO accounts that should have access to the scan results, and what the intended use is (accessibility scanning, broken link checking, etc.).
Once your site and account are set up, log in at uoregon.dubbot.com
To have the DubBot module added into your Drupal setup, contact your site administrator.
Editoria11y Accessibility Checker
Editoria11y is a free automated accessibility scanning tool available for Drupal.
Recommended Users
Communicators and content editors who use Drupal
Benefits and Use
Editoria11y performs on-demand automated accessibility evaluations of individual pages in Drupal.
Editoria11y provides simple, easy to understand results.
Editoria11y can be used to evaluate live changes on a page that is being edited.
Findings can be displayed and highlighted on a page to quickly locate and resolve issues.
Editoria11y is already set up on many Drupal sites.
Limitations
As an automated accessibility scanner , this tool is limited in what issues it can identify. As a rough guide, assume that this tool will only be able to find about 15% of the accessibility violations on a page or site, and the remaining 85% will require manual review . For simple site edits (e.g., adding basic text and images), the tool will catch a significantly higher percentage of errors, but some manual checks will still be needed. Common issues that automated tools can detect include whether an image is missing alternative text (but not whether the text is appropriate), whether headings are nested correctly (but not whether they are correctly tagged as headings, what the correct structure is, or whether the text is appropriate), and whether text contrast is insufficient (for certain types of text). Most other accessibility issues cannot be detected by automated scanners.
This tool cannot be relied on to determine whether a page is compliant with accessibility standards, though it can be helpful in locating problem pages and content and identifying certain types of violations.
This tool does not provide any site-level reporting (in contrast to DubBot ).
This tool does not conduct any other types of scans.
To use Editora11y on Drupal, it must be installed and configured by a site administrator.
Help and Documentation
Editora11y is intended to be a simple and relatively self-explanatory tool.
Documentation (UO Service Portal)
Video: Introduction to Editoria11y (recording from August 2024 UO Web Community of Practice meeting)
How to Get Access
Drupal admins must add the Editoria11y module and ensure that user roles have access. After enabling the module, admins will need to enable the following permissions for the editor user accounts: Mark as hidden in Editoria11y
View Editoria11y checker
Once installed, log in to edit a site in Drupal, navigate to the desired page, and open the tool via the check button at the bottom-right corner of the page.
Accessibility Insights
Accessibility Insights is a free manual accessibility evaluation tool available as a browser extension for Chrome and Edge. Please use the "Assessment" option when conducting evaluations with this tool.
Recommended Users
Web developers and designers
Advanced accessibility evaluators
Benefits and Use
The Accessibility Insights "Assessment" option provides guided manual reviews of web pages via a browser extension.
The Accessibility Insights "Assessment" option provides far more robust and reliable results than any automated tool, and will enable users to find the majority of accessibility violations on a page.
Accessibility Insights can be used to evaluate live changes on a page.
Accessibility Insights runs via a browser extension, and therefore does not require any administrative setup on a site and can be used on platforms other than Drupal.
Limitations
The Accessibility Insights "Assessment" option, as a guided manual evaluation, takes a significant amount of time to use. Users may spend an hour or more testing a single page.
This tool does not provide any site-level reporting.
This tool does not conduct any other types of scans.
The Accessibility Insights browser extension is only available for Chrome and Edge.
Help and Documentation
Accessibility Insights for Web Documentation
How to Get Access
Download Accessibility Insights
Color Contrast Tools
While automated testing tools can identify many some color contrast issues, they don't work in all scenarios (particularly if you are using pictures as a background). In addition to allowing you to test color contrast and providing immediate feedback on whether a color combination meets our standard (WCAG 2.1 AA), both of the tools below include sliders to let you quickly adjust the colors to find a combination that works.
Colour Contrast Analyzer from the Paciello Group is a free program for Windows and Mac that includes an eyedropper tool that allows testing what you're actually seeing on your screen, instead of just relying on color codes.
The WebAIM Color Contrast Checker is a simple web page that allows you to enter color codes (hex values).
If you're using UO brand colors, we've already done the testing for you, and you can use our UO Color Contrast page to determine what combinations work.
Screen Readers
Screen readers are a type of assistive technology that provide an audio version of visual content, reading out text, describing images, and allowing the user to interact with a computer without relying on looking at the screen. Screen readers are widely used by people who are blind or who have low vision, as well as some people who have reading, language, or learning disabilities.
There is no substitute for testing with assistive technologies - no matter how well we expect something to work with assistive technologies, there's no way to confirm it unless we actually test it with those technologies. There is a learning curve to screen reader usage, so we don't expect everyone to test with them.
If you're using Windows , you have two primary options: You can download NVDA for free on the NVDA website " Using NVDA to Evaluate Web Accessibility " from WebAIM
UO has licensed JAWS for all employees and students, and you can get it by following the Knowledge Base instructions " Using JAWS to Evaluate Web Accessibility " from WebAIM
If you're using Mac or iOS , VoiceOver is already built in " Using VoiceOver to Evaluate Web Accessibility " from WebAIM
" VoiceOver on Mobile " from WebAIM
If you're using Android , TalkBack is likely already installed on your device " Using TalkBack to Evaluate Web Accessibility " from WebAIM
Screen Magnifiers
Some people with low vision use screen magnifiers, software that acts like a magnifying glass, enlarging the content wherever the cursor is pointing, up to 20x size. Some screen magnification software also reads out the content that has visual focus.
UO has licensed ZoomText for all employees and students, and you can get it by following the Knowledge Base instructions .
You can also zoom in on many computer programs without special software, but only to a lower level and without advanced options. In many Windows programs, for example, you can hold the Control key and hit "+" and "-" or hold Control and scroll the mouse wheel. Current accessibility standards require that should be able to zoom the content up to 200% without any loss of functionality. Many websites switch to a mobile layout at this level of zoom, which is acceptable as long as no content is totally removed.
