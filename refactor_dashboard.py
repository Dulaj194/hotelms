import re

filepath = "frontend/src/components/shared/DashboardLayout.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "  const renderSidebarSection = (id: string) => {"
end_marker = "        <nav"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("Could not find the bounds of renderSidebarSection.")
    exit(1)

new_render_function = """  const renderSidebarSection = (id: string) => {
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

    type GroupConfig = {
      key: keyof SidebarGroupState;
      label: string;
      icon: any;
      isActive: boolean;
      isOpen: boolean;
      subItems: any[];
      isSpecialOffer?: boolean;
      badgeNode?: React.ReactNode;
      lockedNode?: React.ReactNode;
    };

    let config: GroupConfig | null = null;

    switch (id) {
      case "menus":
        config = {
          key: "menusOpen",
          label: "Menus",
          icon: SquareMenu,
          isActive: isMenuGroupActive,
          isOpen: menusOpen,
          subItems: menuSubItems,
        };
        break;
      case "ops":
        config = {
          key: "opsOpen",
          label: "Kitchen Operations",
          icon: CookingPot,
          isActive: isOpsGroupActive,
          isOpen: opsOpen,
          subItems: visibleOpsSubItems,
        };
        break;
      case "comm":
        config = {
          key: "commOpen",
          label: "Communication",
          icon: MessageSquare,
          isActive: isCommGroupActive,
          isOpen: commOpen,
          subItems: visibleCommSubItems,
        };
        break;
      case "finance":
        config = {
          key: "financeOpen",
          label: "Finance",
          icon: Ticket,
          isActive: isFinanceGroupActive,
          isOpen: financeOpen,
          subItems: visibleFinanceSubItems,
        };
        break;
      case "settings":
        config = {
          key: "settingsOpen",
          label: "Settings",
          icon: Settings,
          isActive: isSettingsGroupActive,
          isOpen: settingsOpen,
          subItems: visibleSettingsSubItems,
        };
        break;
      case "qr":
        config = {
          key: "qrOpen",
          label: "QR Codes",
          icon: QrCode,
          isActive: isQrGroupActive,
          isOpen: qrOpen,
          subItems: visibleQrSubItems,
        };
        break;
      case "housekeeping":
        config = {
          key: "housekeepingOpen",
          label: "Housekeeping",
          icon: Handshake,
          isActive: isHousekeepingGroupActive,
          isOpen: housekeepingOpen,
          subItems: visibleHousekeepingSubItems,
          badgeNode: housekeepingPendingCount > 0 ? (
            <span className="ml-auto mr-3 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-black shadow-lg shadow-orange-500/30">
              {housekeepingPendingCount}
            </span>
          ) : null,
        };
        break;
      case "offers":
        config = {
          key: "offersOpen",
          label: "Offers",
          icon: ShieldCheck,
          isActive: isOfferGroupActive,
          isOpen: offersOpen,
          subItems: visibleOfferSubItems,
          isSpecialOffer: true,
          badgeNode: (!privilegesLoading && !offerPrivilegeEnabled) ? (
            <span className="ml-auto mr-3 inline-flex items-center justify-center rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-500 border border-amber-500/20 uppercase tracking-widest">
              Locked
            </span>
          ) : null,
          lockedNode: (!privilegesLoading && !offerPrivilegeEnabled) ? (
            <div className="mt-3 mx-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Module Locked</p>
                <p className="text-[11px] text-amber-500/80 font-medium leading-snug">
                  Unlock the Offers module from package access to open these tools.
                </p>
              </div>
            </div>
          ) : null,
        };
        break;
    }

    if (!config) return null;

    const Icon = config.icon;
    const isOffers = id === "offers";

    return (
      <div className={`mb-2 ${isOffers ? "mt-4 pt-4 border-t border-white/5" : ""}`} key={id}>
        <button
          type="button"
          onClick={() => toggleGroup(config!.key)}
          aria-expanded={config.isOpen}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
            config.isActive
              ? "bg-white/10 text-white shadow-sm"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          }`}
        >
          <span className="flex items-center">
            <Icon className={`h-4 w-4 mr-4 shrink-0 ${config.isActive ? (isOffers ? "text-amber-400" : "text-blue-400") : ""}`} />
            {config.label}
          </span>
          {config.badgeNode}
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${config.isOpen ? "rotate-180 text-white" : "text-slate-500"}`}
            />
          </div>
        </button>

        {config.isOpen && (
          <div className="mt-2 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {config.subItems.map((subItem) => {
              let subActive = location.pathname === subItem.path || (id === "finance" && location.pathname.startsWith(subItem.path));
              if (id === "offers" && subItem.path === "/admin/offers") {
                subActive = location.pathname === "/admin/offers" || (location.pathname.startsWith("/admin/offers/") && location.pathname !== "/admin/offers/new");
              }
              const SubIcon = subItem.icon;
              
              let subBadgeNode = null;
              if (id === "ops" && subItem.label === "Kitchen Queue" && badgeCounts.awaiting > 0) {
                subBadgeNode = (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-black text-white shadow-sm shadow-blue-500/30 animate-pulse">
                    {badgeCounts.awaiting}
                  </span>
                );
              } else if (id === "comm" && subItem.label === "Guest Requests" && badgeCounts.requests > 0) {
                subBadgeNode = (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-sm shadow-rose-500/30 animate-pulse">
                    {badgeCounts.requests}
                  </span>
                );
              } else if (id === "housekeeping" && subItem.path === "/admin/housekeeping" && housekeepingPendingCount > 0) {
                subBadgeNode = (
                  <span className="ml-auto flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-black shadow-lg shadow-orange-500/30">
                    {housekeepingPendingCount}
                  </span>
                );
              }

              return (
                <Link
                  key={subItem.path + (subItem.label || "")}
                  to={subItem.path}
                  onClick={handleSidebarNavigate}
                  className={`flex items-center px-4 py-2 text-sm font-medium transition-all rounded-xl border-l-2 ${
                    subActive
                      ? (isOffers ? "bg-amber-500/10 text-amber-400 border-amber-500" : "bg-blue-500/10 text-blue-400 border-blue-500")
                      : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                >
                  <SubIcon className="h-4 w-4 mr-4 shrink-0" />
                  <span>{subItem.label}</span>
                  {subBadgeNode}
                </Link>
              );
            })}
            {config.lockedNode}
          </div>
        )}
      </div>
    );
  };

"""

content = content[:start_idx] + new_render_function + content[end_idx:]

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
