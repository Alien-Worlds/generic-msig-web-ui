const WALLET_ICONS: Record<string, string> = {
  anchor: "/assets/icons/anchor.svg",
  wombat: "/assets/icons/wombat.svg",
  cloudwallet: "/assets/icons/wcw.svg",
};

interface WalletProviderIconProps {
  walletPluginId?: string;
}

export function WalletProviderIcon({
  walletPluginId,
}: WalletProviderIconProps) {
  const key = walletPluginId?.toLowerCase();
  const src =
    key && WALLET_ICONS[key]
      ? WALLET_ICONS[key]
      : WALLET_ICONS.anchor;
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 bg-black rounded-[4px] border border-[#1F1F1F]"
      style={{ width: 24, height: 24 }}
    >
      <img
        src={src}
        alt=""
        className="object-contain"
        style={{ width: 14, height: 14 }}
      />
    </div>
  );
}
