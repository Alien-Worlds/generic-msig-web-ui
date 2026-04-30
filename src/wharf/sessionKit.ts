import {
  SessionKit,
} from '@wharfkit/session';
import { WebRenderer } from '@wharfkit/web-renderer';
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor';
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet';
import { WalletPluginWombat } from '@wharfkit/wallet-plugin-wombat';
import { chains } from '../chains';

const sessionKit = new SessionKit(
  {
    appName: 'Generic MSIG',
    chains,
    ui: new WebRenderer(),
    walletPlugins: [
      new WalletPluginAnchor(),
      new WalletPluginCloudWallet(),
      new WalletPluginWombat(),
    ],
  },
  {}
);

export { sessionKit };
