/* global window */
// const { clusterApiUrl, Connection } = require('@solana/web3.js');
import createSigningData from './createSigningData';
import ParseUser from './ParseUser';
import ParseQuery from './ParseQuery';
import ParseObject from './ParseObject';
import ParseACL from './ParseACL';

class MoralisPhantom {
  static getProvider = () => {
    if ('solana' in window) {
      const provider = window.solana;
      if (provider.isPhantom) {
        return provider;
      }
    }
    window.open('https://phantom.app/', '_blank');
  };

  static async authenticate(options) {
    const phantom = MoralisPhantom.getProvider();
    if (!phantom) throw new Error('Phantom wallet not available');
    await phantom.connect();

    const solAddress = phantom.publicKey.toString();

    if (!solAddress) throw new Error('Address not found');

    const accounts = [solAddress];

    const message = options?.signingMessage || MoralisPhantom.getSigningData();

    const data = await createSigningData(message);
    const signature = await MoralisPhantom.sign(message);
    const authData = { id: solAddress, signature, data };
    const user = await ParseUser.logInWith('moralisSol', { authData });
    await user.setACL(new ParseACL(user));
    if (!user) throw new Error('Could not get user');
    user.set('solAccounts', uniq([].concat(accounts, user.get('solAccounts') ?? [])));
    user.set('solAddress', solAddress);
    await user.save();
    return user;
  }

  static async link(account) {
    const user = await ParseUser.current();
    const solAddress = account;
    const SolAddress = ParseObject.extend('_SolAddress');
    const query = new ParseQuery(SolAddress);
    const solAddressRecord = await query.get(solAddress).catch(() => null);
    if (!solAddressRecord) {
      const data = MoralisPhantom.getSigningData();
      const signature = await MoralisPhantom.sign(solAddress, data);
      const authData = { id: solAddress, signature, data };
      await user.linkWith('moralisSol', { authData });
    }
    user.set('SolAccounts', uniq([solAddress].concat(user.get('SolAccounts') ?? [])));
    user.set('solAddress', solAddress);
    await user.save();
    return user;
  }

  static async unlink(account) {
    const accountsLower = account;
    const SolAddress = ParseObject.extend('_SolAddress');
    const query = new ParseQuery(SolAddress);
    const solAddressRecord = await query.get(accountsLower);
    await solAddressRecord.destroy();
    const user = await ParseUser.current();
    const accounts = user.get('solAccounts') ?? [];
    const nextAccounts = accounts.filter(v => v !== accountsLower);
    user.set('solAccounts', nextAccounts);
    user.set('solAddress', nextAccounts[0]);
    await user._unlinkFrom('moralisSol');
    await user.save();
    return user;
  }

  static async sign(message) {
    const phantom = MoralisPhantom.getProvider();
    const encodedMessage = new TextEncoder().encode(message);
    const signedMessage = await phantom.signMessage(encodedMessage, 'utf8');
    return signedMessage.signature.toString();
  }

  static getSigningData() {
    return 'Moralis Authentication';
  }
}

function uniq(arr) {
  return arr.filter((v, i) => arr.indexOf(v) === i);
}

export default MoralisPhantom;
