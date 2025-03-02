import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { CompxProposalClient } from '../contracts/clients/CompxProposalClient';
import algosdk, { Algodv2 } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { algos } from '@algorandfoundation/algokit-utils';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

//------
let appClient: CompxProposalClient;
let appAddress: string;
//------
//------
const proposalTitle = 'Test Proposal';
const proposalDescription = 'This is a test proposal';
const expiresIn = 1000;
//------
let algorandClient: algokit.AlgorandClient;
let algodClient: Algodv2;
//------

describe('CompxProposal', () => {
  beforeEach(fixture.beforeEach);
  let proposalCreator: algosdk.Account;
  let daoVoter: TransactionSignerAccount;

  beforeAll(async () => {
    await fixture.beforeEach();
    const { testAccount } = fixture.context;
    proposalCreator = testAccount;

    const { algorand } = fixture;
    algorandClient = algorand;

    daoVoter = await algorandClient.account.kmd.getOrCreateWalletAccount('tealscript-dao-sender', algos(10));

    await algorandClient.send.payment({
      sender: testAccount.addr,
      receiver: daoVoter.addr,
      amount: algokit.microAlgos(1_000_000), // Send 1 Algo to the new wallet
    });

    appClient = new CompxProposalClient({ sender: testAccount, resolveBy: 'id', id: 0 }, algorand.client.algod);

    await appClient.create.createApplication({
      proposalTitle: proposalTitle,
      proposalDescription: proposalDescription,
      expires_in: expiresIn,
    });
  });

  test('Should create the application successfully', async () => {
    const appState = await appClient.appClient.getGlobalState();
    console.log('appState', appState);

    expect(appState.total_votes.value).toBe(0);
  });

  test('Should allow a valid vote and update vote count', async () => {
    const voteYes = true;
    const vote_mbr = 1_952; // Define the minimum balance requirement
    const { appAddress } = await appClient.appClient.getAppReference();

    const mbrTxn = algorandClient.send.payment({
      sender: daoVoter.addr,
      amount: algokit.microAlgos(vote_mbr),
      receiver: appAddress,
      signer: daoVoter.signer,
    });

    // Send the vote transaction
    await appClient.makeProposalVote({ mbrTxn: mbrTxn, voteYes: voteYes }, { sender: daoVoter });
    // Retrieve the updated app state
    const appState = await appClient.appClient.getGlobalState();

    expect(appState.total_votes.value).toBe(1);
    expect(appState.yes_votes.value).toBe(1);
  });
});
