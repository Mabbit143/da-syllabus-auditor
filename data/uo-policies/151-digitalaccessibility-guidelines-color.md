# Color and Contrast | Digital Accessibility @ UO

Source: https://digitalaccessibility.uoregon.edu/guidelines/color
Fetched: 2026-10-27
Found from: https://teaching.uoregon.edu/digital-accessibility-teaching

Color and Contrast
While color can be extremely useful in design and in differentiating content for many people, if it's not used correctly, it can be a significant barrier. When color is the only way that information is conveyed, people who are blind, people who cannot perceive that color difference, and people who perceive colors differently may be totally unable to understand it. When the contrast of content is too low, many people with low vision or color blindness may not be able to see or differentiate it. For example, having light grey text on a white background or blue text on a red background makes the text unreadable for many users.
It's therefore critical to ensure that text, user interface components, and important graphics have enough contrast, and to ensure that color is never the only way that information is conveyed.
Guidelines
Text must have at least a 4.5:1 contrast ratio against the background.
Large text, user interface components (buttons, form inputs, etc.), and critical graphical elements (like icons, parts of a chart or graph, etc.) must have at least a 3:1 contrast ratio.
Color cannot be the only way that important information is conveyed or differentiated.
How to Test
Confirm that regular text has a contrast ratio of at least 4.5:1 against the background and that large text, graphics, and UI components have at least a 3:1 contrast ratio. Use a color contrast tool to check the contrast ratio of text, UI components, and important graphical elements. For basic documents with text on a solid background, enter the foreground and background colors into the tool, and check the contrast ratio it reports. "Foreground" means the text color, but it doesn't matter whether you reverse them - the ratio will be the same.
Use the dropper function in Colour Contrast Analyser to manually test contrast by selecting individual pixels on the screen.
Tools that test the code (e.g., DubBot, WAVE on web pages or Microsoft Word's built-in accessibility checker) may work for solid text on a solid background, but don't work when backgrounds vary (e.g., text on a photograph or pattern), and may also fail for responsive web designs that cause the text and/or background to display differently at different resolutions or zoom levels. They also won't work for testing the contrast of graphical or user interface elements.
For text on top of a background that isn't a solid color (including photographs, gradients, graphics, etc.), check where the contrast is lowest - for example, if white text is on top of a photograph, check the contrast of white against the lightest-color pixels adjacent to the text. All parts of all letters should have enough contrast!
For charts and graphs or for other situations in which color differentiates content (for example, the text color of visited links vs. unvisited links), check both the contrast against the background and the contrast between each of the other colors. For example, in a simple line chart with only two lines, one red and one green, with a white background, there needs to be a 3:1 contrast ratio between the red and green, red and white, and green and white. Contrast differences can convey meaning, but purely color differences are not allowed.
When using official UO brand colors (like UO green and UO yellow), consult the UO Color Contrast page for a quick chart that provides details on what color combinations do and do not meet the requirements.
Confirm that there are non-color ways to differentiate all content. For graphical and user interface elements differentiated only by contrast, make sure there's at least a 3:1 ratio against both the background and against any other elements that it's being visually differentiated from. For example, if there's a line chart with only two lines, one red and one green, on a white background, there needs to be at least a 3:1 contrast ratio between the red and white, green and white, and red and green.
For charts and graphs, confirm that there are patterns or other visual differentiators when contrast is not sufficiently different. For example, a line chart might use different types of solid, dashed, and dotted lines.
Confirm that link text is underlined or has another visual differentiator, or that there is at least a 3:1 contrast ratio between link text color and regular (non-link) text color, as well as for visited vs. unvisited vs. hover/focused colors for links (if they are displayed differently).
For other information conveyed by color, check for a text or graphical differentiator. For example, if errors in a form are shown by red text (instead of black text), there should also be text that says "error," an asterisk, or an icon next to each error, so that even if someone cannot see that the text is a different color, they can still tell where each error is.
Confirm that instructions and descriptions do not depend solely on color to be understood.
Additional Resources
UO Color Contrast
