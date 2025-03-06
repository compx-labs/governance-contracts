import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { CompxGovernanceClient } from '../contracts/clients/CompxGovernanceClient';
import algosdk, { Algodv2, Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { algos } from '@algorandfoundation/algokit-utils';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

// App clients -------------------------------------------
let governanceAppClient: CompxGovernanceClient;
//--------------------------------------------------------

//Environment clients ------------------------------------
let algorandClient: algokit.AlgorandClient;
//--------------------------------------------------------

// Relevant user accounts ------------------------------------
let deployerAccount: algosdk.Account;
let proposerAccount: algosdk.Account;
let voterAccount: TransactionSignerAccount;
//--------------------------------------------------------

// Relevant addresses ------------------------------------
let deployerAddress: string;
let proposerAddress: string;
let voterAddress: string;
let governanceAppAddress: string;
//--------------------------------------------------------
// Relevant app IDs --------------------------------------
let proposalAppId: number;
//--------------------------------------------------------

// Proposal data -----------------------------------------
const proposalTitle = 'Test Proposal 123';
const proposalDescription = 'This is a test proposal';
const expiresIn = 1000;
const proposalMbrValue = 2_915;
//--------------------------------------------------------

describe('CompxProposal', () => {
  beforeEach(fixture.beforeEach);

  beforeAll(async () => {
    await fixture.beforeEach();
    const { algorand } = fixture;
    //Setup environment clients ------------------------------
    algorandClient = algorand;
    //-------------------------------------------------------

    const { testAccount } = fixture.context;

    // Setup relevant accounts and addresses ----------------
    deployerAccount = testAccount;
    proposerAccount = deployerAccount;
    voterAccount = await algorandClient.account.kmd.getOrCreateWalletAccount('governance-voter-account', algos(10));

    deployerAddress = deployerAccount.addr;
    proposerAddress = proposerAccount.addr;
    voterAddress = voterAccount.addr;
    //-------------------------------------------------------

    //Fund the voter account --------------------------------
    await algorandClient.send.payment({
      sender: deployerAddress,
      receiver: voterAddress,
      amount: algokit.microAlgos(1_000_000), // Send 1 Algo to the new wallet
    });
    //-------------------------------------------------------

    //Setup app clients -------------------------------------
    governanceAppClient = new CompxGovernanceClient(
      { sender: deployerAccount, resolveBy: 'id', id: 0 },
      algorand.client.algod
    );
    await governanceAppClient.create.createApplication({}, { sender: deployerAccount });
    const { appAddress: govAppAddress } = await governanceAppClient.appClient.getAppReference();
    governanceAppAddress = govAppAddress;

    await algorandClient.send.payment({
      sender: proposerAddress,
      amount: algokit.microAlgos(1000000),
      receiver: governanceAppAddress,
      extraFee: algokit.algos(0.001),
    });
    //-------------------------------------------------------
  });

  //Test if the application was created successfully---------
  test('Should create the application successfully', async () => {
    const appState = await governanceAppClient.appClient.getGlobalState();
    expect(appState.total_proposals.value).toBe(0);
  });
  //----------------------------------------------------------

  //Test if deployer can create a new proposal----------------
  test('Deployer should be able to create a new proposal', async () => {
    const mbrTxn = algorandClient.send.payment({
      sender: proposerAddress,
      amount: algokit.microAlgos(proposalMbrValue),
      receiver: governanceAppAddress,
      extraFee: algokit.algos(0.001),
    });

    await governanceAppClient.createNewProposal(
      { proposalTitle, proposalType: 'pool', proposalDescription, expiresIn, mbrTxn: mbrTxn },
      { sender: deployerAccount }
    );
  });
  //----------------------------------------------------------

  //Test if deployer can create a second proposal but with a type of 'reg'
  test('Deployer should be able to create a new proposal', async () => {
    const mbrTxn = algorandClient.send.payment({
      sender: proposerAddress,
      amount: algokit.microAlgos(proposalMbrValue),
      receiver: governanceAppAddress,
      extraFee: algokit.algos(0.001),
    });

    await governanceAppClient.createNewProposal(
      { proposalTitle, proposalType: 'reg', proposalDescription, expiresIn, mbrTxn: mbrTxn },
      { sender: deployerAccount }
    );
  });
  //----------------------------------------------------------

  test('Get all boxes', async () => {
    const allBoxes = await governanceAppClient.appClient.getBoxNames();

    console.log('all boxes', allBoxes);
  });
});
