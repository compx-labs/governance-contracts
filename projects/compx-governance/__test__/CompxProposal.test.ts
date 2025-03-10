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
let voterAccount: TransactionSignerAccount;
const votingPower = 42000;
//--------------------------------------------------------

// Proposal data -----------------------------------------
const poolProposalTitle = 'Pool proposal title';
const poolProposalDescription = 'This is the pool proposal description';
const regularProposalTitle = 'Regular proposal title';
const regularProposalDescription = 'This is the regular proposal description';
const expiresIn = 1000n;
const proposalMbrValue = 2_915n;
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
    voterAccount = await algorand.account.kmd.getOrCreateWalletAccount('governance-voter-account', algos(100));
    algorand.account.setSignerFromAccount(voterAccount);
    await algorand.account.ensureFundedFromEnvironment(voterAccount.addr, algokit.algos(100));

    //-------------------------------------------------------

    const deployerInfo = await algorand.account.getInformation(deployerAccount.addr);
    const voterInfo = await algorand.account.getInformation(voterAccount.addr);
    consoleLogger.debug('deployer account balance', deployerInfo.balance.microAlgos);
    consoleLogger.debug('voter account balance', voterInfo.balance.microAlgos);
    expect(deployerInfo.balance.microAlgos).toBeGreaterThan(0);
    expect(voterInfo.balance.microAlgos).toBeGreaterThan(0);
    // Fund the voter account --------------------------------
    await algorand.send.payment({
      sender: deployerAccount.addr,
      receiver: voterAccount.addr,
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
        amount: algokit.microAlgos(proposalMbrValue),
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
          proposalType: proposalTypeTest,
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
      sender: voterAccount.addr,
    });

    // Verify that the user is opted-in by checking their local state exists
    const accountInfo = governanceAppClient.state.local(voterAccount.addr);
    const { userSpecialVotes, userContribution, userVotes } = await accountInfo.getAll();

    consoleLogger.debug(
      'account info after optin in to the application',
      `user_contribution:${userContribution}, user_votes:${userVotes}, user_special_votes:${userSpecialVotes}`
    );

    //
    expect(userContribution).toBe(1n);
  });

  //---------------------------------------------------------
  // User should be able to vote on a  reg (0) proposal with Id 3
  test('User should be able to vote on a regular proposal', async () => {
    for (let i = 1; i <= 4; i++) {
      // Make proposal vote
      await governanceAppClient.send.makeProposalVote({
        args: {
          proposalId: { nonce: BigInt(i) },
          voterAddress: voterAccount.addr.toString(),
          votingPower: votingPower + i * 1000,
          inFavor: i % 2 ? true : false,
        },
        sender: deployerAccount.addr,
      });
    }

    // Verify that the user is opted-in by checking their local state exists
    const { userContribution, userVotes, userSpecialVotes } = await governanceAppClient.state
      .local(voterAccount.addr)
      .getAll();
    const totalCurrentVotingPower = governanceAppClient.state.global.totalCurrentVotingPower();

    consoleLogger.debug(
      'account info after voting on a regular proposal',
      `user_contribution:${userContribution}, user_votes:${userVotes}, user_special_votes:${userSpecialVotes}`
    );

    expect(userVotes).toBe(4n);
    expect(userContribution).toBe(3n);
    expect(userSpecialVotes).toBe(2n);
  });

  //---------------------------------------------------------
  // User should not be be able to vote on a pool (2) proposal with Id - sender is not deployer
  test.skip('User should not be able to vote on a pool proposal! Gets its contribution points slashed for it', async () => {
    // Verify that the user is opted-in by checking their local state exists
    const { userContribution, userVotes } = await governanceAppClient.state.local(voterAccount.addr).getAll();

    consoleLogger.debug(
      'account info before being slashed',
      `user_contribution:${userContribution}, user_votes:${userVotes}`
    );
    // If this user doesn't vote it will get slashed
    const slashResult = await governanceAppClient.send.slashUserContribution({
      args: { userAddress: voterAccount.addr.toString(), amount: 1n },
    });

    // Verify that the user is opted-in by checking their local state exists
    const userContributionAfter = await governanceAppClient.state.local(voterAccount.addr).userContribution();
    consoleLogger.debug('user contribution after slashing', userContributionAfter);
    expect(userContributionAfter).toBe(2n);

    // Make proposal vote
    const result = await governanceAppClient.send.makeProposalVote({
      args: { proposalId: { nonce: 2n }, inFavor: true, voterAddress: voterAccount.addr.toString(), votingPower },
      sender: deployerAccount.addr,
    });

    expect(result).toThrow();
  });

  //---------------------------------------------------------

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
