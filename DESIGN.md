# FileForge --- Design System & UI Specification

## 1. Design Goal

FileForge is a privacy-first, premium file utility application. The
interface must feel:

-   Clean
-   Minimal
-   Modern
-   Professional
-   Calm
-   Lightweight
-   Premium without looking flashy
-   Easy to understand at a glance
-   Desktop-first while remaining responsive

The visual direction must closely follow the provided FileForge
dashboard mockup.

**Important:** Preserve the overall visual language shown in the
reference. Do not introduce unrelated colors, gradients, decorative
effects, glassmorphism, excessive shadows, or a different design system.

------------------------------------------------------------------------

# 2. Overall Visual Style

## 2.1 Theme

Primary theme: warm white / off-white with soft brown accents.

The application background should be a very light warm neutral rather
than pure bright white.

Recommended palette:

-   App background: `#FAF9F7`
-   Main surface: `#FFFFFF`
-   Secondary surface: `#F8F5F2`
-   Primary text: `#111827`
-   Secondary text: `#718096`
-   Muted text: `#94A3B8`
-   Primary brown: `#8B6B52`
-   Dark brown: `#6F503B`
-   Light brown: `#EDE4DC`
-   Brown-tinted hover: `#F4ECE6`
-   Border: `#E7E5E2`
-   Dashed border: `#E3DED8`
-   Success background: `#E8F6F0`
-   Success text: `#287A61`

These are reference values. Small adjustments are allowed only when
necessary for accessibility or consistency.

------------------------------------------------------------------------

# 3. Typography

Use a modern sans-serif font.

Preferred:

-   Inter
-   SF Pro Display / SF Pro Text
-   Geist
-   Manrope

Use one primary font consistently throughout the application.

## Font hierarchy

### Page title

-   Size: 34--40px desktop
-   Weight: 700--750
-   Line height: 1.1
-   Color: primary text

### Page subtitle

-   Size: 16px
-   Weight: 400--450
-   Line height: 1.5
-   Color: secondary text

### Section heading

-   Size: 21--24px
-   Weight: 650--700
-   Line height: 1.2

### Navigation label

-   Size: 15--16px
-   Weight: 500--600

### Card title

-   Size: 15--17px
-   Weight: 650--700

### Card description

-   Size: 13--14px
-   Weight: 400--450
-   Line height: 1.4

### Small metadata

-   Size: 12--13px
-   Weight: 400--500

Avoid oversized typography except for the main page heading.

------------------------------------------------------------------------

# 4. Border Radius System

The reference uses noticeably rounded components. Corners should feel
soft and premium.

Use these radius values:

-   Tiny elements: 8px
-   Small buttons/chips: 12px
-   Icon containers: 12--14px
-   Navigation items: 14px
-   Standard cards: 16px
-   Large cards: 18--20px
-   Upload/drop area: 16px
-   Profile/theme circular controls: 50%
-   Fully pill-shaped badges/buttons: 999px

Do not use sharp square corners.

------------------------------------------------------------------------

# 5. Button System

Buttons must have generous rounding and comfortable internal spacing.

## Primary button

Used for actions such as **Select Files**.

-   Height: 42--46px
-   Horizontal padding: 18--22px
-   Border radius: 999px
-   Background: primary brown
-   Text: white
-   Font size: 14--15px
-   Font weight: 600
-   Icon size: 18px
-   Gap between icon and text: 8px
-   No hard black border
-   Very subtle shadow

Example visual:

`[ Upload Icon  Select Files ]`

### Hover

-   Slightly darker brown
-   Very subtle elevation

### Pressed

-   Slightly darker
-   Scale/elevation change should be extremely subtle

### Disabled

-   Reduced contrast
-   No strong shadow

## Secondary button

-   Height: 40--44px
-   Border radius: 999px
-   Background: warm neutral
-   Text: dark brown
-   Optional thin border

## Icon-only button

Used for theme toggle, profile, overflow menu, arrows, etc.

-   Size: 40--44px
-   Border radius: 50%
-   Icon: 18--21px
-   Background: transparent or very light neutral
-   Center icon perfectly

------------------------------------------------------------------------

# 6. Sidebar

The desktop dashboard contains a fixed left sidebar.

## Dimensions

-   Width: approximately 270px
-   Full viewport height
-   Right-side divider: 1px
-   Background: slightly warmer than the main content area
-   Internal horizontal padding: 18--20px

The sidebar should remain visually quiet and not compete with the main
content.

## Logo area

Top-left:

-   Small rounded-square folder logo
-   Approximate size: 34--38px
-   Brown/taupe background
-   White folder icon
-   Logo text: `FileForge`
-   Font size: 22--24px
-   Weight: 700--750
-   Gap between logo and name: 12px

Top spacing: - Approximately 22--26px

## Navigation

Items:

1.  Home
2.  Tools
3.  History
4.  Settings

Each item:

-   Height: 48px
-   Width: 100%
-   Border radius: 14px
-   Horizontal padding: 14px
-   Icon: 21--23px
-   Gap: 14px
-   Text size: 15--16px
-   Weight: 500

### Active navigation item

Home is active in the reference.

-   Background: light warm brown
-   Text: dark brown
-   Icon: dark brown
-   Radius: 14px

Do not use a strong filled brown active state.

### Navigation hover

-   Background: very light warm neutral
-   Smooth transition: 150--200ms

## Sidebar bottom message

At the bottom-left:

Shield/check-style icon followed by:

`Fast. Simple. Powerful.`

-   Small icon
-   Size: 16--18px
-   Muted brown/gray
-   Text size: 12--13px
-   Positioned near bottom with comfortable padding

------------------------------------------------------------------------

# 7. Main Content Area

## Desktop layout

Main content begins immediately after the sidebar.

Recommended:

-   Sidebar: 270px
-   Main content: remaining viewport width
-   Main content horizontal padding: 34--38px
-   Top padding: 34--38px
-   Maximum content width: approximately 1200--1250px
-   Center the content when the viewport is significantly wider

The reference has generous whitespace.

Do not make the page feel crowded.

------------------------------------------------------------------------

# 8. Top Header

At the top of the main content:

## Greeting chip

Small rounded pill:

`Hello 👋`

-   Height: 30--34px
-   Padding: 10--14px
-   Radius: 999px
-   Background: warm neutral
-   Text: brown
-   Font size: 13px
-   Weight: 600

## Main title

`Welcome to FileForge`

-   Large bold heading
-   Approx. 36px
-   Weight: 700+
-   Tight line height
-   Margin-top: 8--10px

## Subtitle

`Privacy-first file utilities — everything runs on your device.`

-   Approx. 16px
-   Muted gray
-   Margin-top: 6--8px

## Top-right actions

Theme toggle and profile button.

### Theme button

-   42--46px circular container
-   Very light warm background
-   Sun icon
-   19--21px
-   Centered

### Profile button

-   46px circular container
-   Very light warm background
-   User outline icon
-   19--21px

Spacing between both: 12px.

------------------------------------------------------------------------

# 9. Upload / Drop Zone

This is the primary hero action.

## Outer card

-   Full available width
-   Minimum height: approximately 280px
-   Background: white
-   Border: 1px solid `#E7E5E2`
-   Border radius: 18--20px
-   Very subtle shadow
-   Padding: 16px

## Inner dashed area

The upload zone has its own dashed border.

-   Border: 2px dashed
-   Color: `#E3DED8`
-   Border radius: 15--17px
-   Full available width/height
-   Center all content vertically and horizontally

### Upload illustration

Centered folder illustration:

-   Approx. 70--90px visual area
-   Warm brown folder
-   Small plus badge
-   Tiny decorative sparkle/line details are acceptable
-   Keep decoration subtle
-   Do not use unrelated illustrations

### Main upload text

`Drop files here or click to select`

-   Size: 18px
-   Weight: 650--700
-   Color: primary text
-   Center aligned

### Supporting text

`Supports multiple files • No data leaves your device`

-   Size: 14px
-   Color: secondary text
-   Center aligned
-   Margin-top: 6--8px

### Select Files button

Place below supporting text.

-   Margin-top: 18px
-   Height: 42--46px
-   Fully rounded
-   Brown fill
-   White upload icon
-   White text

## Drop state

When files are dragged over the zone:

-   Slight warm-brown background tint
-   Dashed border becomes slightly darker
-   Do not use a dramatic animation
-   Preserve the same layout

------------------------------------------------------------------------

# 10. Section Layout

Every major section follows this pattern:

`[Section Icon] Section Title                         View All >`

## Section header

-   Display: flex
-   Align-items: center
-   Height: approximately 32px
-   Margin-bottom: 14--16px

### Section icon

-   21--24px
-   Brown/dark neutral
-   Examples:
    -   History clock
    -   Grid/tools icon

### Section title

-   21--23px
-   Weight: 700
-   Dark text

### View All

Right aligned.

-   Text: 12--13px
-   Muted gray
-   Weight: 500
-   Arrow: 16px
-   Gap: 8px
-   Hover should slightly darken

------------------------------------------------------------------------

# 11. Recent Activity

The reference contains a list of recent file operations.

Each activity row is a white rounded card.

## Activity card

-   Width: 100%
-   Height: approximately 84px
-   Border: 1px solid `#E7E5E2`
-   Border radius: 16px
-   Background: white
-   Very subtle shadow
-   Horizontal padding: 18--20px
-   Display: flex
-   Align-items: center

Vertical gap between rows:

-   12--14px

## File type icon container

-   Size: 56px
-   Border radius: 13--14px
-   Light tinted background
-   Center icon
-   Icon size: 23--25px

Different tools may use different soft icon backgrounds:

-   Image: soft blue
-   PDF: soft red/pink
-   ZIP: soft purple
-   Document: soft green

Keep all colors pastel and restrained.

## Activity text

Filename:

-   14--15px
-   Weight: 600
-   Dark

Metadata:

Example:

`image-convert  •  2.8 MB  •  Sep 13, 2026 09:25 PM`

-   12--13px
-   Gray
-   Use small circular bullets between metadata values

## Status badge

`✓ Completed`

-   Pill shape
-   Height: 30--32px
-   Padding: 10--13px
-   Background: pale green
-   Text: green
-   Font size: 12px
-   Weight: 600

## Overflow menu

Three vertical dots.

-   Icon size: 18--20px
-   40px clickable area
-   Circular/rounded hover background
-   Positioned at far right

------------------------------------------------------------------------

# 12. Popular Tools

The reference uses a four-column tool-card grid on desktop.

## Grid

Desktop:

-   4 columns
-   Equal width
-   Gap: 14--16px

Tablet:

-   2 columns

Mobile:

-   1 column

## Tool card

Approximate height:

-   160px

Properties:

-   Background: white
-   Border: 1px solid `#E7E5E2`
-   Border radius: 16px
-   Padding: 18--20px
-   Very subtle shadow
-   Position: relative

Do not use heavy card shadows.

## Tool icon

-   44--48px container
-   Border radius: 13--14px
-   Pastel tinted background
-   Icon size: 22--24px

## Tool title

-   15--17px
-   Weight: 650--700
-   Dark text
-   Margin-top: 10--12px

## Tool description

-   13--14px
-   Gray
-   Maximum 2--3 lines
-   Line height: 1.4

Example:

`Convert between JPG, PNG and WebP`

## Card action arrow

Bottom-right circular button.

-   Size: 36px
-   Fully circular
-   Background: warm neutral
-   Arrow: dark brown
-   Icon size: 17--18px

On hover: - Background becomes slightly darker warm neutral - Arrow
moves 1--2px to the right - Keep animation subtle

------------------------------------------------------------------------

# 13. Card Shadow System

Use extremely subtle shadows.

Recommended:

### Standard card

`0 2px 8px rgba(30, 25, 20, 0.04)`

### Hover

`0 5px 16px rgba(30, 25, 20, 0.07)`

Avoid:

-   Large black shadows
-   Neon glow
-   Colored glow
-   Strong 3D effects

The reference relies more on borders and whitespace than shadows.

------------------------------------------------------------------------

# 14. Spacing System

Use a consistent 4px-based spacing scale.

-   4px
-   8px
-   12px
-   16px
-   20px
-   24px
-   28px
-   32px
-   40px
-   48px
-   56px
-   64px

Typical dashboard rhythm:

-   Header → Upload card: 26--30px
-   Upload card → Recent Activity: 28--34px
-   Section heading → list/card: 14--16px
-   Activity rows: 12--14px
-   Recent Activity → Popular Tools: 30--36px

Whitespace is an important part of the design.

------------------------------------------------------------------------

# 15. Icons

Use one consistent outline icon library.

Recommended:

-   Lucide
-   Phosphor
-   Heroicons outline

Icon style:

-   Outline
-   Rounded stroke caps
-   Stroke width around 1.8--2px
-   Avoid mixing filled and outline icons unnecessarily

Required icons include:

-   Folder
-   Home
-   Wrench/tools
-   History/clock
-   Settings
-   Shield
-   Sun
-   User
-   Upload
-   Plus
-   Image
-   PDF/file
-   ZIP
-   Document
-   Arrow-right
-   Chevron-right
-   More vertical
-   Check

Icons must be vertically and horizontally centered inside their
containers.

------------------------------------------------------------------------

# 16. Responsive Design

## Desktop ≥ 1200px

-   Fixed sidebar visible
-   Four-column Popular Tools
-   Full-width upload area
-   Header actions on top-right

## Tablet 768--1199px

-   Sidebar may remain compact or convert to a narrower navigation
-   Popular Tools: 2 columns
-   Activity rows remain horizontal
-   Reduce main horizontal padding

## Mobile \< 768px

-   Sidebar becomes bottom navigation or compact drawer
-   Main content padding: 16px
-   Page title becomes approximately 28--30px
-   Upload zone becomes shorter
-   Popular Tools: 1 column
-   Activity cards may stack status/actions if required
-   Header actions remain accessible
-   Preserve rounded visual language

Never allow content to overflow horizontally.

------------------------------------------------------------------------

# 17. Interaction & Animation

Animations should be subtle and fast.

Default transition:

-   150--200ms
-   Ease-out

Use animation for:

-   Navigation hover
-   Button hover
-   Card hover
-   Arrow movement
-   Upload drag state
-   Dropdown/menu appearance

Avoid:

-   Bouncing
-   Excessive scaling
-   Large page transitions
-   Continuous decorative animation

The interface should feel fast and utility-focused.

------------------------------------------------------------------------

# 18. Accessibility

-   Maintain readable contrast
-   Every icon-only button needs an accessible label
-   Buttons must have a minimum comfortable click/tap area of about 40px
-   Do not communicate status through color alone
-   Keyboard focus must be visible
-   Drag-and-drop must have a normal file-selection alternative
-   Text should remain readable at increased browser zoom

------------------------------------------------------------------------

# 19. Dashboard Content Reference

The first dashboard should visually contain:

### Sidebar

-   FileForge logo
-   Home
-   Tools
-   History
-   Settings
-   Bottom privacy/performance statement

### Header

-   Hello chip
-   Welcome to FileForge
-   Privacy-first subtitle
-   Theme toggle
-   Profile button

### Upload

-   Large upload card
-   Dashed drop zone
-   Folder + icon
-   Drop files message
-   Supporting privacy/multiple-file message
-   Select Files button

### Recent Activity

-   Section icon
-   Recent Activity title
-   View All
-   Recent file rows
-   File type icon
-   Filename
-   Tool name
-   File size
-   Date/time
-   Completed badge
-   Overflow menu

### Popular Tools

-   Section icon
-   Popular Tools title
-   View All
-   Four tool cards
-   Tool icon
-   Tool name
-   Description
-   Circular arrow button

------------------------------------------------------------------------

# 20. Important Design Rules

1.  Match the provided mockup's overall composition and spacing.
2.  Keep the interface white/warm-white and brown accented.
3.  Make buttons and controls noticeably rounded.
4.  Use 999px pills for primary action buttons and status chips.
5.  Use approximately 16--20px radius for major cards.
6.  Use circular icon buttons where shown.
7.  Keep borders soft and subtle.
8.  Keep shadows extremely light.
9.  Use generous whitespace.
10. Do not introduce gradients unless they are absolutely required by an
    existing component.
11. Do not introduce neon colors.
12. Do not use glassmorphism.
13. Do not use excessive blur.
14. Do not use oversized decorative illustrations.
15. Do not make cards unnecessarily tall.
16. Keep iconography consistent.
17. Keep all text aligned cleanly.
18. Maintain consistent left/right edges between sections.
19. Preserve the premium utility-app feeling.
20. The design should look polished even with minimal content.

------------------------------------------------------------------------

# 21. Component Checklist

The implementation should provide reusable components for:

-   `Sidebar`
-   `Logo`
-   `NavigationItem`
-   `TopHeader`
-   `GreetingChip`
-   `IconButton`
-   `UploadDropZone`
-   `PrimaryButton`
-   `SectionHeader`
-   `ActivityList`
-   `ActivityCard`
-   `StatusBadge`
-   `ToolGrid`
-   `ToolCard`
-   `ToolIcon`
-   `OverflowMenu`

Components should use the same spacing, radius, typography, border, and
shadow tokens defined above.

------------------------------------------------------------------------

# 22. Final Visual Target

The finished application should immediately resemble the provided
reference:

**Warm white background + white surfaces + soft brown accents + rounded
controls + thin borders + subtle shadows + clean outline icons +
generous whitespace + strong typography.**

The most important visual characteristics are:

-   Rounded
-   Clean
-   Spacious
-   Soft
-   Professional
-   Privacy-focused
-   Premium
-   Minimal

Do not redesign the visual identity into a different style. Improve
polish and consistency while staying faithful to this reference.
