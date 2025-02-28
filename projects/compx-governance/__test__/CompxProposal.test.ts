import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { CompxProposalClient } from '../contracts/clients/CompxProposalClient';
import algosdk, { Algodv2 } from 'algosdk';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

let appClient: CompxProposalClient;
let algodClient: Algodv2;

const proposalTitle = 'Test Proposal';
const proposalDescription = 'This is a test proposal';
const expiresIn = 1000;

describe('CompxProposal', () => {
  beforeEach(fixture.beforeEach);
  let proposalCreator: algosdk.Account;

  beforeAll(async () => {
    await fixture.beforeEach();
    const { testAccount } = fixture.context;
    proposalCreator = testAccount;

    const { algorand } = fixture;
    algodClient = algorand.client.algod;

    appClient = new CompxProposalClient({
      sender: proposalCreator,
      resolveBy: 'id',
      id: 0,
    });

    await appClient.create.createApplication({
      proposalTitle,
      proposalDescription,
      expires_in: expiresIn,
    });
  });

  test('Should create the application successfully', async () => {
    const appState = await appClient.appClient.getGlobalState();
    expect(appState.total_votes.value).toBe(0);
    expect(appState.compx_governance_main_address.value).toBeDefined();
  });
});
