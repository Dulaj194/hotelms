import re
import os

filepath = "frontend/src/components/shared/DashboardLayout.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Add imports
imports = """import { Settings2 } from "lucide-react";
import { SidebarOrderModal } from "./SidebarOrderModal";
import type { SidebarItemConfig } from "./SidebarOrderModal";
"""

content = re.sub(
    r'(import type \{ ReactNode \} from "react";)',
    r'\1\n' + imports,
    content
)

# Add storage key
content = re.sub(
    r'const SIDEBAR_SCROLL_STORAGE_KEY = "hotelms\.sidebar\.scrollTop\.admin";',
    r'const SIDEBAR_SCROLL_STORAGE_KEY = "hotelms.sidebar.scrollTop.admin";\nconst SIDEBAR_ORDER_STORAGE_KEY = "hotelms.sidebar.order.admin.v1";',
    content
)

# Add state
state_block = """  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const [savedOrder, setSavedOrder] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(SIDEBAR_ORDER_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }
    return [];
  });

  const handleSaveOrder = (newOrder: string[]) => {
    setSavedOrder(newOrder);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_ORDER_STORAGE_KEY, JSON.stringify(newOrder));
    }
  };

  const handleResetOrder = () => {
    setSavedOrder([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SIDEBAR_ORDER_STORAGE_KEY);
    }
  };
"""
content = re.sub(
    r'  const \[mobileSidebarOpen, setMobileSidebarOpen\] = useState\(false\);',
    state_block,
    content
)


# Add availableSections and orderedSections right before toggleGroup
sections_logic = """  const availableSections = useMemo(() => {
    const sections: SidebarItemConfig[] = [];
    if (isMenuGroupVisible) sections.push({ id: "menus", label: "Menus", icon: SquareMenu });
    if (isOpsGroupVisible) sections.push({ id: "ops", label: "Kitchen Operations", icon: CookingPot });
    if (isCommGroupVisible) sections.push({ id: "comm", label: "Communication", icon: MessageSquare });
    if (isFinanceGroupVisible) sections.push({ id: "finance", label: "Finance", icon: Ticket });
    if (isSettingsGroupVisible) sections.push({ id: "settings", label: "Settings", icon: Settings });
    if (isQrGroupVisible) sections.push({ id: "qr", label: "QR Codes", icon: QrCode });
    if (isHousekeepingGroupVisible) sections.push({ id: "housekeeping", label: "Housekeeping", icon: Handshake });
    
    navItems.forEach(item => {
      sections.push({ id: `nav_${item.path}`, label: item.label, icon: item.icon });
    });
    
    if (isOfferGroupVisible) sections.push({ id: "offers", label: "Offers", icon: ShieldCheck });
    
    return sections;
  }, [
    isMenuGroupVisible,
    isOpsGroupVisible,
    isCommGroupVisible,
    isFinanceGroupVisible,
    isSettingsGroupVisible,
    isQrGroupVisible,
    isHousekeepingGroupVisible,
    isOfferGroupVisible,
    navItems
  ]);

  const orderedSections = useMemo(() => {
    if (!savedOrder || savedOrder.length === 0) return availableSections;
    
    const sorted = [...availableSections].sort((a, b) => {
      const indexA = savedOrder.indexOf(a.id);
      const indexB = savedOrder.indexOf(b.id);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
    return sorted;
  }, [availableSections, savedOrder]);

"""
content = re.sub(
    r'(  const toggleGroup =)',
    sections_logic + r'\1',
    content
)


# The big challenge is rewriting the `<nav>` block.
# We will use regex to find the blocks and wrap them in the render function.

nav_start = content.find('        <nav\n')
nav_end = content.find('        </nav>\n')
nav_content = content[nav_start:nav_end]

replacement = """
  const renderSidebarSection = (id: string) => {
    switch (id) {
      case "menus":
        return (
          <div className="mb-2" key="menus">
            <button
              type="button"
              onClick={() => toggleGroup("menusOpen")}
              aria-expanded={menusOpen}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isMenuGroupActive
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span className="flex items-center">
                <SquareMenu className={`h-4 w-4 mr-4 shrink-0 ${isMenuGroupActive ? "text-blue-400" : ""}`} />
                Menus
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${menusOpen ? "rotate-180 text-white" : "text-slate-500"}`}
              />
            </button>

            {menusOpen && (
              <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {menuSubItems.map((subItem) => {
                  const subActive = location.pathname === subItem.path;
                  const SubIcon = subItem.icon;
                  return (
                    <Link
                      key={subItem.path}
                      to={subItem.path}
                      onClick={handleSidebarNavigate}
                      className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                        subActive
                          ? "bg-blue-500/10 text-blue-400 border-blue-500"
                          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                      {subItem.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "ops":
        return (
          <div className="mb-2" key="ops">
            <button
              type="button"
              onClick={() => toggleGroup("opsOpen")}
              aria-expanded={opsOpen}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isOpsGroupActive
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span className="flex items-center">
                <CookingPot className={`h-4 w-4 mr-4 shrink-0 ${isOpsGroupActive ? "text-blue-400" : ""}`} />
                Kitchen Operations
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${opsOpen ? "rotate-180 text-white" : "text-slate-500"}`}
              />
            </button>

            {opsOpen && (
              <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {visibleOpsSubItems.map((subItem) => {
                  const subActive = location.pathname === subItem.path;
                  const SubIcon = subItem.icon;
                  return (
                    <Link
                      key={subItem.label + subItem.path}
                      to={subItem.path}
                      onClick={handleSidebarNavigate}
                      className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                        subActive
                          ? "bg-blue-500/10 text-blue-400 border-blue-500"
                          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                      <span>{subItem.label}</span>
                      {subItem.label === "Kitchen Queue" && badgeCounts.awaiting > 0 && (
                        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-black text-white shadow-sm shadow-blue-500/30 animate-pulse">
                          {badgeCounts.awaiting}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "comm":
        return (
          <div className="mb-2" key="comm">
            <button
              type="button"
              onClick={() => toggleGroup("commOpen")}
              aria-expanded={commOpen}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isCommGroupActive
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span className="flex items-center">
                <MessageSquare className={`h-4 w-4 mr-4 shrink-0 ${isCommGroupActive ? "text-blue-400" : ""}`} />
                Communication
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${commOpen ? "rotate-180 text-white" : "text-slate-500"}`}
              />
            </button>

            {commOpen && (
              <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {visibleCommSubItems.map((subItem) => {
                  const subActive = location.pathname === subItem.path;
                  const SubIcon = subItem.icon;
                  return (
                    <Link
                      key={subItem.label + subItem.path}
                      to={subItem.path}
                      onClick={handleSidebarNavigate}
                      className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                        subActive
                          ? "bg-blue-500/10 text-blue-400 border-blue-500"
                          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                      <span>{subItem.label}</span>
                      {subItem.label === "Guest Requests" && badgeCounts.requests > 0 && (
                        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-sm shadow-rose-500/30 animate-pulse">
                          {badgeCounts.requests}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "finance":
        return (
          <div className="mb-2" key="finance">
            <button
              type="button"
              onClick={() => toggleGroup("financeOpen")}
              aria-expanded={financeOpen}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isFinanceGroupActive
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span className="flex items-center">
                <Ticket className={`h-4 w-4 mr-4 shrink-0 ${isFinanceGroupActive ? "text-blue-400" : ""}`} />
                Finance
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${financeOpen ? "rotate-180 text-white" : "text-slate-500"}`}
              />
            </button>

            {financeOpen && (
              <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {visibleFinanceSubItems.map((subItem) => {
                  const subActive = location.pathname === subItem.path || location.pathname.startsWith(subItem.path);
                  const SubIcon = subItem.icon;
                  return (
                    <Link
                      key={subItem.label + subItem.path}
                      to={subItem.path}
                      onClick={handleSidebarNavigate}
                      className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                        subActive
                          ? "bg-blue-500/10 text-blue-400 border-blue-500"
                          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                      <span>{subItem.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "settings":
        return (
          <div className="mb-2" key="settings">
            <button
              type="button"
              onClick={() => toggleGroup("settingsOpen")}
              aria-expanded={settingsOpen}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isSettingsGroupActive
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span className="flex items-center">
                <Settings className={`h-4 w-4 mr-4 shrink-0 ${isSettingsGroupActive ? "text-blue-400" : ""}`} />
                Settings
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${settingsOpen ? "rotate-180 text-white" : "text-slate-500"}`}
              />
            </button>

            {settingsOpen && (
              <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {visibleSettingsSubItems.map((subItem) => {
                  const subActive = location.pathname === subItem.path;
                  const SubIcon = subItem.icon;
                  return (
                    <Link
                      key={subItem.label + subItem.path}
                      to={subItem.path}
                      onClick={handleSidebarNavigate}
                      className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                        subActive
                          ? "bg-blue-500/10 text-blue-400 border-blue-500"
                          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                      <span>{subItem.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "qr":
        return (
          <div className="mb-2" key="qr">
            <button
              type="button"
              onClick={() => toggleGroup("qrOpen")}
              aria-expanded={qrOpen}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isQrGroupActive
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span className="flex items-center">
                <QrCode className={`h-4 w-4 mr-4 shrink-0 ${isQrGroupActive ? "text-blue-400" : ""}`} />
                QR Codes
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${qrOpen ? "rotate-180 text-white" : "text-slate-500"}`}
              />
            </button>

            {qrOpen && (
              <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {visibleQrSubItems.map((subItem) => {
                  const subActive = location.pathname === subItem.path;
                  const SubIcon = subItem.icon;
                  return (
                    <Link
                      key={subItem.path}
                      to={subItem.path}
                      onClick={handleSidebarNavigate}
                      className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                        subActive
                          ? "bg-blue-500/10 text-blue-400 border-blue-500"
                          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                      {subItem.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "housekeeping":
        return (
          <div className="mb-2" key="housekeeping">
            <button
              type="button"
              onClick={() => toggleGroup("housekeepingOpen")}
              aria-expanded={housekeepingOpen}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isHousekeepingGroupActive
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span className="flex items-center">
                <Handshake className={`h-4 w-4 mr-4 shrink-0 ${isHousekeepingGroupActive ? "text-blue-400" : ""}`} />
                Housekeeping
              </span>
              {housekeepingPendingCount > 0 && (
                <span className="ml-auto mr-3 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-black shadow-lg shadow-orange-500/30">
                  {housekeepingPendingCount}
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${housekeepingOpen ? "rotate-180 text-white" : "text-slate-500"}`}
              />
            </button>

            {housekeepingOpen && (
              <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {visibleHousekeepingSubItems.map((subItem) => {
                  const subActive = location.pathname === subItem.path;
                  const SubIcon = subItem.icon;
                  return (
                    <Link
                      key={subItem.path}
                      to={subItem.path}
                      onClick={handleSidebarNavigate}
                      className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                        subActive
                          ? "bg-blue-500/10 text-blue-400 border-blue-500"
                          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                      <span>{subItem.label}</span>
                      {subItem.path === "/admin/housekeeping" && housekeepingPendingCount > 0 && (
                        <span className="ml-auto flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-black shadow-lg shadow-orange-500/30">
                          {housekeepingPendingCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "offers":
        return (
          <div className="mt-4 mb-2 pt-4 border-t border-white/5" key="offers">
            <button
              type="button"
              onClick={() => toggleGroup("offersOpen")}
              aria-expanded={offersOpen}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isOfferGroupActive
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span className="flex items-center">
                <ShieldCheck className={`h-4 w-4 mr-4 shrink-0 ${isOfferGroupActive ? "text-amber-400" : ""}`} />
                Offers
              </span>
              {!privilegesLoading && !offerPrivilegeEnabled && (
                <span className="ml-auto mr-3 inline-flex items-center justify-center rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-500 border border-amber-500/20 uppercase tracking-widest">
                  Locked
                </span>
              )}
              <div className="flex items-center gap-2">
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${offersOpen ? "rotate-180 text-white" : "text-slate-500"}`}
                />
              </div>
            </button>

            {offersOpen && (
              <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {visibleOfferSubItems.map((subItem) => {
                  const subActive =
                    subItem.path === "/admin/offers"
                      ? location.pathname === "/admin/offers" ||
                        (location.pathname.startsWith("/admin/offers/") &&
                          location.pathname !== "/admin/offers/new")
                      : location.pathname === subItem.path;
                  const SubIcon = subItem.icon;
                  return (
                    <Link
                      key={subItem.path}
                      to={subItem.path}
                      onClick={handleSidebarNavigate}
                      className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                        subActive
                          ? "bg-amber-500/10 text-amber-400 border-amber-500"
                          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                      {subItem.label}
                    </Link>
                  );
                })}
                {!privilegesLoading && !offerPrivilegeEnabled && (
                  <div className="mt-3 mx-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                    <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Module Locked</p>
                      <p className="text-[11px] text-amber-500/80 font-medium leading-snug">
                        Unlock the Offers module from package access to open these tools.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      default:
        if (id.startsWith("nav_")) {
          const path = id.replace("nav_", "");
          const item = navItems.find((i) => i.path === path);
          if (!item) return null;
          
          const resolvedPath = item.path === "/admin/billing" ? billingNavPath : item.path;
          const active =
            item.path === "/admin/billing"
              ? location.pathname === "/admin/billing" ||
                location.pathname.startsWith("/admin/billing/")
              : location.pathname === resolvedPath ||
                location.pathname.startsWith(`${resolvedPath}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={resolvedPath}
              onClick={handleSidebarNavigate}
              className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-bold transition-all mb-2 ${
                active
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon className={`h-4 w-4 mr-4 shrink-0 ${active ? "text-blue-400" : ""}`} />
              {item.label}
            </Link>
          );
        }
        return null;
    }
  };
"""

new_nav = """        <nav
          ref={sidebarNavRef}
          onScroll={handleSidebarScroll}
          className="flex-1 overflow-y-auto py-6 space-y-1.5 px-3 no-scrollbar"
        >
          {orderedSections.map(section => renderSidebarSection(section.id))}
        </nav>
        <div className="p-4 border-t border-white/5 bg-white/5 backdrop-blur-sm space-y-2">
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-blue-500/10 hover:text-blue-400 transition-all"
          >
            <Settings2 className="h-4 w-4" />
            Customize Sidebar
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            Logout
          </button>
        </div>
      </aside>

      <SidebarOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        items={availableSections}
        onSave={handleSaveOrder}
        onReset={handleResetOrder}
      />
"""

start_nav_full = content.find('        <nav')
end_aside = content.find('      </aside>', start_nav_full) + len('      </aside>')

content = content[:start_nav_full] + replacement + "\n" + new_nav + content[end_aside:]

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
