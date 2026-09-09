Remember to update this file when completing.

# follow-up
-> harness section redesign: replaced static 01-04 flow list with an interactive
   slider-driven swarm (2-80 agents, live repopulate, hoverable/focusable agent
   dots with role tooltips) and a connected pipeline of 4 expandable stages.
   files: sections/harness.html, scripts/swarm.js, style.css (harness block)
   status: solved

# task 1
-> b1  visual bug to fix:
         ref=visualbug1
         it occurs in hero.html
         javascript proably
         status: solved (scripts/wordmark.js: switched hover tracking to pointermove/pointerleave + scroll reset so stuck highlight can't survive a missed mouseleave)
-> b2  visual bug to fix:
         make the typewruite | to papear at end of text by default, not start, more convenient, better UX
         hero.html likely
         status: invalid (no typewriter/cursor effect exists anywhere in the codebase; nothing to fix)
-> b3  visual bug to fix:
        finest work section: simplicity text not aligned optically with work text
        style.css or maybe works.html likelly
        status: solved (style.css: align-items: baseline on .works-title-block, plus scaled .works-word font-size 100px->121px (56px on mobile) to match the dot-wordmark's visual cap-height, verified with a real screenshot)
-> b4  visual not matching reality:
        edit nav.html, keep essential, remove what does not yet exist, keep them just commented out
        status: solved (sections/nav.html: kept Product's 3 real links + theme toggle, commented out Pricing/Docs/About dropdowns, Latest Updates, Dot System, Log in/Sign up)
-> b5  visual not matching reality:
        edit lists, add comming soon to all
        status: solved (sections/product.html: all 5 work-list items now have .soon class + Coming soon tag)

# task 2
-> b1  edit lists, make them less AI generated text content
        status: solved (sections/product.html: shortened work-row-desc copy for all 5 items)
-> a1  add lenis scroll for heavy and smooth scrolling
        status: solved (added Lenis via CDN in main.js load chain + scripts/lenis-init.js)