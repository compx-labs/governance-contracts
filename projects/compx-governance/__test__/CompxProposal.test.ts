import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { CompxProposalClient } from '../contracts/clients/CompxProposalClient';
import algosdk, { Algodv2 } from 'algosdk';

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

  beforeAll(async () => {
    await fixture.beforeEach();
    const { testAccount } = fixture.context;
    proposalCreator = testAccount;

    const { algorand } = fixture;
    algorandClient = algorand;

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
});
