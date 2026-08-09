import os

filepath = "frontend/src/components/shared/DashboardLayout.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Find the start of renderSidebarSection
render_start = content.find("  const renderSidebarSection = (id: string) => {")
# Find the end of renderSidebarSection which is right before the new <nav>
# Let's search for "  };" that closes the switch statement, followed by "        <nav"
nav_start = content.find('        <nav\n          ref={sidebarNavRef}', render_start)

# The end of the render function is right before nav_start.
render_block = content[render_start:nav_start]

# We need to remove render_block from its current position
content = content[:render_start] + content[nav_start:]

# Now insert render_block right before "  return ("
return_idx = content.find("  return (\n")
content = content[:return_idx] + render_block + "\n" + content[return_idx:]

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
