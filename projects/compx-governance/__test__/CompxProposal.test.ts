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
let votingPower = 42000;
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
const poolProposalTitle = 'Pool proposal title';
const poolProposalDescription = 'This is the pool proposal description';
const regularProposalTitle = 'Regular proposal title';
const regularProposalDescription = 'This is the regular proposal description';
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
    const numberOfProposals = 4;
    for (let i = 1; i <= numberOfProposals; i++) {
      const mbrTxn = algorandClient.send.payment({
        sender: proposerAddress,
        amount: algokit.microAlgos(proposalMbrValue),
        receiver: governanceAppAddress,
        extraFee: algokit.algos(0.001),
      });

      let proposalTypeTest = 0;
      let proposalTitleTest = regularProposalTitle;
      let proposalDescritpionTest = regularProposalDescription;
      if (i % 2 === 0) {
        proposalTypeTest = 1;
        proposalTitleTest = poolProposalTitle;
        proposalDescritpionTest = poolProposalDescription;
      }
      await governanceAppClient.createNewProposal(
        {
          proposalTitle: proposalTitleTest,
          proposalType: proposalTypeTest,
          proposalDescription: proposalDescritpionTest,
          expiresIn,
          mbrTxn: mbrTxn,
        },
        { sender: deployerAccount }
      );
    }
  });
  //----------------------------------------------------------

  //----------------------------------------------------------
  // User should be able to opt-in to the smart contract by excuting the opt in method

  test('User should be able to opt-in to the smart contract', async () => {
    await governanceAppClient.optIn.optInToApplication({}, { sender: voterAccount });

    // Verify that the user is opted-in by checking their local state exists
    const accountInfo = await governanceAppClient.getLocalState(voterAccount.addr);
    const userContribution = accountInfo.user_contribution?.asBigInt();
    const userVotes = accountInfo.user_votes?.asBigInt();
    const userSpecialVotes = accountInfo.user_special_votes?.asBigInt();

    console.log(
      'account info after optin in to the application',
      `user_contribution:${userContribution}, user_votes:${userVotes}, user_special_votes:${userSpecialVotes}`
    );

    //
    expect(Number(userContribution)).toBe(1);
  });

  //---------------------------------------------------------
  // User should be able to vote on a  reg (0) proposal with Id 3
  test('User should be able to vote on a regular proposal', async () => {
    for (let i = 1; i <= 4; i++) {
      //Make proposal vote
      await governanceAppClient.makeProposalVote(
        {
          proposalId: [i],
          voterAddress: voterAddress,
          votingPower: votingPower + i * 1000,
          inFavor: i % 2 ? true : false,
        },
        { sender: deployerAccount }
      );
    }

    // Verify that the user is opted-in by checking their local state exists
    const accountInfo = await governanceAppClient.getLocalState(voterAccount.addr);
    const userContribution = accountInfo.user_contribution?.asBigInt();
    const userVotes = accountInfo.user_votes?.asBigInt();
    const userSpecialVotes = accountInfo.user_special_votes?.asBigInt();
    const totalCurrentVotingPower = (await governanceAppClient.getGlobalState()).total_current_voting_power;

    console.log(
      'account info after voting on a regular proposal',
      `user_contribution:${userContribution}, user_votes:${userVotes}, user_special_votes:${userSpecialVotes}`
    );

    expect(Number(userVotes)).toBe(4);
    expect(Number(userContribution)).toBe(3);
    expect(Number(userSpecialVotes)).toBe(2);
  });

  //---------------------------------------------------------
  // User should not be be able to vote on a pool (2) proposal with Id - sender is not deployer
  test('User should not be able to vote on a pool proposal! Gets its contribution points slashed for it', async () => {
    // Verify that the user is opted-in by checking their local state exists
    let accountInfo = await governanceAppClient.getLocalState(voterAccount.addr);
    const userContribution = accountInfo.user_contribution?.asBigInt();
    const userVotes = accountInfo.user_votes?.asBigInt();

    console.log('account info before being slashed', `user_contribution:${userContribution}, user_votes:${userVotes}`);
    // If this user doesn't vote it will get slashed
    const slashResult = await governanceAppClient.slashUserContribution({ userAddress: voterAddress, amount: 1 });

    // Verify that the user is opted-in by checking their local state exists
    accountInfo = await governanceAppClient.getLocalState(voterAccount.addr);

    console.log('user contribution after slashing', accountInfo.user_contribution?.asBigInt());

    //Make proposal vote
    const result = await governanceAppClient.makeProposalVote(
      { proposalId: [2], inFavor: true, voterAddress: voterAddress, votingPower: votingPower },
      { sender: voterAccount }
    );

    expect(result).toThrow();
  });

  //---------------------------------------------------------

  test('Get all proposals by id', async () => {
    const totalProposals = (await governanceAppClient.getGlobalState()).total_proposals?.asNumber()!;

    for (let i = 0; i < totalProposals; i++) {
      const proposal = (await governanceAppClient.getProposalsById({ proposalId: [i + 1] })).return;
      console.log('proposal', proposal);
    }
  });
});
