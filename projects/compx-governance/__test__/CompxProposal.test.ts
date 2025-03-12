/* eslint-disable no-plusplus */
/* eslint-disable no-unneeded-ternary */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-unused-vars */
import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { AlgorandClient, algos } from '@algorandfoundation/algokit-utils';
import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging';
import { CompxGovernanceClient, CompxGovernanceFactory } from '../contracts/clients/CompxGovernanceClient';
import { PROPOSAL_MBR, VOTE_MBR } from '../contracts/constants.algo';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

// App clients -------------------------------------------
let governanceAppClient: CompxGovernanceClient;
//--------------------------------------------------------

// Environment clients ------------------------------------
let algorand: algokit.AlgorandClient;
//--------------------------------------------------------

// Relevant user accounts ------------------------------------
let deployerAccount: TransactionSignerAccount;
let proposerAccount: TransactionSignerAccount;
let voterOneAccount: TransactionSignerAccount;
let voterTwoAccount: TransactionSignerAccount;
const votingPowerOne = 42000;
const votingPowerTwo = 30000;
//--------------------------------------------------------

// Proposal data -----------------------------------------
const poolProposalTitle = 'Pool proposal title';
const poolProposalDescription = 'This is the pool proposal description';
const regularProposalTitle = 'Regular proposal title';
const regularProposalDescription = 'This is the regular proposal description';
const expiresIn = 1000n;
//--------------------------------------------------------

describe('CompxProposal', () => {
  beforeEach(fixture.newScope);

  beforeAll(async () => {
    await fixture.newScope();
    // Setup environment clients ------------------------------
    algorand = AlgorandClient.fromEnvironment();
    //-------------------------------------------------------

    // Setup relevant accounts and addresses ----------------
    deployerAccount = await algorand.account.kmd.getOrCreateWalletAccount('deployer-account', algos(100));
    algorand.account.setSignerFromAccount(deployerAccount);
    await algorand.account.ensureFundedFromEnvironment(deployerAccount.addr, algokit.algos(100));
    proposerAccount = deployerAccount;
    voterOneAccount = await algorand.account.kmd.getOrCreateWalletAccount('governance-voter-account', algos(100));
    voterTwoAccount = await algorand.account.kmd.getOrCreateWalletAccount('governance-voter-account-2', algos(100));
    algorand.account.setSignerFromAccount(voterOneAccount);
    algorand.account.setSignerFromAccount(voterTwoAccount);
    await algorand.account.ensureFundedFromEnvironment(voterOneAccount.addr, algokit.algos(100));

    //-------------------------------------------------------

    const deployerInfo = await algorand.account.getInformation(deployerAccount.addr);
    const voterInfo = await algorand.account.getInformation(voterOneAccount.addr);
    consoleLogger.debug('deployer account balance', deployerInfo.balance.microAlgos);
    consoleLogger.debug('voter account balance', voterInfo.balance.microAlgos);
    expect(deployerInfo.balance.microAlgos).toBeGreaterThan(0);
    expect(voterInfo.balance.microAlgos).toBeGreaterThan(0);
    // Fund the voter account --------------------------------
    await algorand.send.payment({
      sender: deployerAccount.addr,
      receiver: voterOneAccount.addr,
      amount: algokit.microAlgos(1_000_000), // Send 1 Algo to the new wallet
    });

    //Adding funds to the new voter
    await algorand.send.payment({
      sender: deployerAccount.addr,
      receiver: voterTwoAccount.addr,
      amount: algokit.microAlgos(1_000_000), // Send 1 Algo to the new wallet
    });
    //-------------------------------------------------------

    // Setup app clients -------------------------------------
    const factory = algorand.client.getTypedAppFactory(CompxGovernanceFactory, { defaultSender: deployerAccount.addr });

    const { appClient } = await factory.send.create.createApplication({
      args: [],
      sender: deployerAccount.addr,
    });

    governanceAppClient = appClient;

    await algorand.send.payment({
      sender: proposerAccount.addr,
      amount: algokit.microAlgos(1000000n),
      receiver: governanceAppClient.appAddress,
      extraFee: algokit.microAlgos(1000n),
    });
    //-------------------------------------------------------
  });

  // Test if the application was created successfully---------
  test('Should create the application successfully', async () => {
    const totalProposals = await governanceAppClient.state.global.totalProposals();
    expect(totalProposals).toBe(0n);
  });
  //----------------------------------------------------------

  // Test if deployer can create a new proposal----------------
  test('Deployer should be able to create a new proposal', async () => {
    const numberOfProposals = 4;
    for (let i = 1; i <= numberOfProposals; i++) {
      const mbrTxn = algorand.createTransaction.payment({
        sender: proposerAccount.addr,
        amount: algokit.microAlgos(PROPOSAL_MBR),
        receiver: governanceAppClient.appAddress,
        extraFee: algokit.microAlgos(1000n),
      });

      let proposalTypeTest = 0;
      let proposalTitleTest = regularProposalTitle;
      let proposalDescritpionTest = regularProposalDescription;
      if (i % 2 === 0) {
        proposalTypeTest = 1;
        proposalTitleTest = poolProposalTitle;
        proposalDescritpionTest = poolProposalDescription;
      }
      await governanceAppClient.send.createNewProposal({
        args: {
          proposalTitle: proposalTitleTest,
          proposalDescription: proposalDescritpionTest,
          expiresIn,
          mbrTxn,
        },
      });
    }
    expect(await governanceAppClient.state.global.totalProposals()).toBe(4n);
  });
  //----------------------------------------------------------

  //----------------------------------------------------------
  // User should be able to opt-in to the smart contract by excuting the opt in method

  test('User should be able to opt-in to the smart contract', async () => {
    await governanceAppClient.send.optIn.optInToApplication({
      args: [],
      populateAppCallResources: true,
      sender: voterOneAccount.addr,
    });

    await governanceAppClient.send.optIn.optInToApplication({
      args: [],
      populateAppCallResources: true,
      sender: voterTwoAccount.addr,
    });

    // Verify that the user is opted-in by checking their local state exists
    const accountInfo = governanceAppClient.state.local(voterOneAccount.addr);
    const { userVotes } = await accountInfo.getAll();

    consoleLogger.debug('account info after optin in to the application', ` user_votes:${userVotes}, `);

    //
    expect(userVotes).toBe(0n);
  });

  //---------------------------------------------------------
  // User 1 should be able to vote on a  reg (0) proposal with Id 3
  test('User 1 should be able to vote on all four regular proposal', async () => {
    for (let i = 1; i <= 4; i++) {

      const mbrTxn = algorand.createTransaction.payment({
        sender: proposerAccount.addr,
        amount: algokit.microAlgos(VOTE_MBR),
        receiver: governanceAppClient.appAddress,
        extraFee: algokit.microAlgos(1000n),
      });
  
      // Make proposal vote
      await governanceAppClient.send.makeProposalVote({
        args: {
          proposalId: { nonce: BigInt(i) },
          voterAddress: voterOneAccount.addr.toString(),
          votingPower: votingPowerOne,
          inFavor: i % 2 ? true : false,
          mbrTxn,
        },
        sender: deployerAccount.addr,
      });


    // Verify that the user is opted-in by checking their local state exists
    const { userVotes } = await governanceAppClient.state.local(voterOneAccount.addr).getAll();
    const totalCurrentVotingPower = await governanceAppClient.state.global.totalCurrentVotingPower();
  
    consoleLogger.info('totalCurrentVotingPower', totalCurrentVotingPower)
     expect(totalCurrentVotingPower).toBe(BigInt(votingPowerOne))

    expect(userVotes).toBe(BigInt(i));
    }

  });

  //---------------------------------------------------------
  // User should not be be able to vote on a pool (2) proposal with Id - sender is not deployer
  test('User should not be able to vote on a proposal, because it already voted and voting power to be 4600', async () => {
    // Verify that the user is opted-in by checking their local state exists
    const { userVotes } = await governanceAppClient.state.local(voterOneAccount.addr).getAll();

    // // If this user doesn't vote it will get slashed
    // const slashResult = await governanceAppClient.send.slashUserContribution({
    //   args: { userAddress: voterAccount.addr.toString(), amount: 1n },
    // });
    const mbrTxn = algorand.createTransaction.payment({
      sender: proposerAccount.addr,
      amount: algokit.microAlgos(VOTE_MBR),
      receiver: governanceAppClient.appAddress,
      extraFee: algokit.microAlgos(1000n),
    });

    const totalCurrentVotingPower = await governanceAppClient.state.global.totalCurrentVotingPower()

    // Make proposal vote
    await expect(
      governanceAppClient.send.makeProposalVote({
        args: {
          proposalId: { nonce: 2n },
          inFavor: true,
          voterAddress: voterOneAccount.addr.toString(),
          votingPower:votingPowerOne,
          mbrTxn,
        },
        sender: deployerAccount.addr,
      })
    ).rejects.toThrowError('User already voted on this proposal');
  });

  //---------------------------------------------------------

  // --------------------------------------------------------
   // User should be able to vote on a  reg (0) proposal with Id 3
    test('User 2 should be able to vote on all four regular proposal', async () => {
      for (let i = 1; i <= 4; i++) {
  
        const mbrTxn = algorand.createTransaction.payment({
          sender: proposerAccount.addr,
          amount: algokit.microAlgos(VOTE_MBR),
          receiver: governanceAppClient.appAddress,
          extraFee: algokit.microAlgos(1000n),
        });
    
        // Make proposal vote
        await governanceAppClient.send.makeProposalVote({
          args: {
            proposalId: { nonce: BigInt(i) },
            voterAddress: voterTwoAccount.addr.toString(),
            votingPower: votingPowerTwo,
            inFavor: i % 2 ? true : false,
            mbrTxn,
          },
          sender: deployerAccount.addr,
        });
  
  
      // Verify that the user is opted-in by checking their local state exists
      const { userVotes } = await governanceAppClient.state.local(voterTwoAccount.addr).getAll();
      const totalCurrentVotingPower = await governanceAppClient.state.global.totalCurrentVotingPower();
  
     consoleLogger.info('totalCurrentVotingPower', totalCurrentVotingPower)
      expect(totalCurrentVotingPower).toBe(BigInt(votingPowerOne+votingPowerTwo))
      expect(userVotes).toBe(BigInt(i));
      }
  
    });
// --------------------------------------------------------
  test('Get all proposals by id', async () => {
    const totalProposals = await governanceAppClient.state.global.totalProposals();

    if (totalProposals !== undefined) {
      for (let i = 0n; i < totalProposals; i++) {
        const proposal = (await governanceAppClient.send.getProposalsById({ args: { proposalId: { nonce: i + 1n } } }))
          .return;
        consoleLogger.debug('proposal', proposal);
      }
    }
  });
});
