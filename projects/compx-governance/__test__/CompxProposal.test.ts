import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { CompxProposalClient } from '../contracts/clients/CompxProposalClient';
import { CompxProposalRegistryClient } from '../contracts/clients/CompxProposalRegistryClient';
import algosdk, { Algodv2 } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { algos } from '@algorandfoundation/algokit-utils';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

//------
let proposalAppClient: CompxProposalClient;
let registryAppClient: CompxProposalRegistryClient;
let daoAddress: string;
let proposalAppId: number;
//------
//------
const proposalTitle = 'Test Proposal';
const proposalDescription = 'This is a test proposal';
const expiresIn = 1000;
//------
let algorandClient: algokit.AlgorandClient;
//------

describe('CompxProposal', () => {
  beforeEach(fixture.beforeEach);
  let proposalCreator: algosdk.Account;
  let daoVoter: TransactionSignerAccount;

  beforeAll(async () => {
    await fixture.beforeEach();
    const { testAccount: compxDaoAccount } = fixture.context;
    proposalCreator = compxDaoAccount;

    const { algorand } = fixture;
    algorandClient = algorand;

    daoVoter = await algorandClient.account.kmd.getOrCreateWalletAccount('tealscript-dao-sender', algos(10));

    await algorandClient.send.payment({
      sender: proposalCreator.addr,
      receiver: daoVoter.addr,
      amount: algokit.microAlgos(1_000_000), // Send 1 Algo to the new wallet
    });

    //------------------------------------------------
    //Creating the registry application
    registryAppClient = new CompxProposalRegistryClient(
      { sender: proposalCreator, resolveBy: 'id', id: 12389719823719 },
      algorand.client.algod
    );
    //await registryAppClient.create.createApplication({}, { sender: proposalCreator });
    //------------------------------------------------

    proposalAppClient = new CompxProposalClient(
      { sender: proposalCreator, resolveBy: 'id', id: 0 },
      algorand.client.algod
    );
  });

  //Test
  test('Should create the application successfully', async () => {
    await proposalAppClient.create.createApplication(
      {
        proposalTitle: proposalTitle,
        proposalDescription: proposalDescription,
        expires_in: expiresIn,
      },
      { sender: proposalCreator }
    );
    const { appAddress, appId } = await proposalAppClient.appClient.getAppReference();
    daoAddress = appAddress;
    proposalAppId = Number(appId);
    //Fund the proposal app account
    await algorandClient.send.payment({
      sender: daoVoter.addr,
      receiver: daoAddress,
      amount: algokit.microAlgos(1_000_000), // Send 1 Algo to the new application address
      signer: daoVoter.signer,
    });
    const appState = await proposalAppClient.appClient.getGlobalState();
    // const registryAppState = await registryAppClient.appClient.getGlobalState();
    console.log('appState', appState);
    // console.log('registryAppState', registryAppState);
    expect(appState.total_votes.value).toBe(0);
  });

  //Make a yes vote
  test('Should allow a valid vote and update vote count', async () => {
    const voteYes = true;
    const vote_mbr = 1_952;
    const mbrTxn = algorandClient.send.payment({
      sender: daoVoter.addr,
      amount: algokit.microAlgos(vote_mbr),
      receiver: daoAddress,
      signer: daoVoter.signer,
    });
    // Send the vote transaction
    await proposalAppClient.makeProposalVote({ mbrTxn: mbrTxn, voteYes: voteYes }, { sender: daoVoter });
    // Retrieve the updated app state
    const appState = await proposalAppClient.appClient.getGlobalState();
    expect(appState.total_votes.value).toBe(1);
    expect(appState.yes_votes.value).toBe(1);
  });

  test('User already voted so this should fail', async () => {
    const voteYes = true;
    const vote_mbr = 1_952;
    const mbrTxn = algorandClient.send.payment({
      sender: daoVoter.addr,
      amount: algokit.microAlgos(vote_mbr),
      receiver: daoAddress,
      signer: daoVoter.signer,
    });
    // Second vote - should fail
    await expect(proposalAppClient.makeProposalVote({ mbrTxn, voteYes }, { sender: daoVoter })).rejects.toThrowError();
  });
});
