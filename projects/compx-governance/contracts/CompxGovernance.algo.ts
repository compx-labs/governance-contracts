import { ProposalIdType, ProposalDataType, ProposalVoteDataType, ProposalVoteIdType } from './proposalConfig.algo';

import { Contract } from '@algorandfoundation/tealscript';

// (8+8) => 8+8+8+8+8+8 = 16 => 48 = 64bits * 0.0004 + 0.00352 = 0.02912
const proposalMbr = 2_912;
export class CompxGovernance extends Contract {
  // Address of the deployer of this contract
  deployer_address = GlobalStateKey<Address>();

  // // Keeps track of the total number of proposals
  total_proposals = GlobalStateKey<uint64>();

  // Boxes to store proposal information
  proposals = BoxMap<ProposalIdType, ProposalDataType>({ prefix: '_p' });

  // Boxes to store proposal votes
  votes = BoxMap<ProposalVoteIdType, ProposalVoteDataType>({ prefix: '_v' });

  //User contribution on governance - Requires user to optin to the contract
  user_contribution = LocalStateKey<uint64>();
  user_votes = LocalStateKey<uint64>();
  user_special_votes = LocalStateKey<uint64>();

  public createApplication() {
    this.total_proposals.value = 0;
    this.deployer_address.value = this.txn.sender;
    this.total_proposals.value = 0;
  }

  /**
   * OPT-IN to the application
   */

  public optInToApplication(): void {
    //Optin in to this contract will add 1 to the user contribution
    const userAddress: Address = this.txn.sender;
    this.user_contribution(userAddress).value = 1;
    this.user_votes(userAddress).value = 0;
    this.user_special_votes(userAddress).value = 0;
  }

  /**
   * Create a new proposal
   * @param proposalType Type of the proposal - can be reg or pool
   * @param proposalTitle Title of the proposal
   * @param proposalDescription Description of the proposal
   * @param expiresIn Time in seconds for the proposal to expire
   */

  public createNewProposal(
    proposalType: uint64,
    proposalTitle: string,
    proposalDescription: string,
    expiresIn: uint64,
    mbrTxn: PayTxn
  ) {
    const proposerAddress: Address = this.txn.sender;

    //The nonce of each proposal auto increments by 1
    const proposalNonce: uint64 = this.total_proposals.value + 1;
    const currentTimestamp: uint64 = globals.latestTimestamp;

    //Defines the expiry time of the proposal
    const expiryTimestamp: uint64 = currentTimestamp + expiresIn;

    // Only the deployer can create proposals - We can change this so anyone can create a proposal
    assert(proposerAddress === this.deployer_address.value, 'Only the deployer can create proposals');
    assert(!this.proposals({ nonce: proposalNonce }).exists, 'Proposal already exists');

    // Contract account will need 2_912 microAlgos to create a proposal box
    verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: proposalMbr } });

    // Create a new proposal with title and description and zero votes
    this.proposals({ nonce: proposalNonce }).value = {
      proposalType: proposalType,
      proposalTitle: proposalTitle,
      proposalDescription: proposalDescription,
      proposalTotalVotes: 0,
      proposalYesVotes: 0,
      proposalTotalPower: 0,
      proposalYesPower: 0,
      createdAtTimestamp: currentTimestamp,
      expiryTimestamp: expiryTimestamp,
    };

    this.total_proposals.value += 1;
  }

  /**
   * Create a new proposal
   * @param voterAddress The address of who is voting
   * @param proposalId Id of the proposal to be voted on
   * @param votingPower The voting power of the voter
   * @param inFavor If the vote is a yes or a no
   */
  private addOneToUserVotes(voterAddress: Address, proposalId: ProposalIdType, votingPower: uint64, inFavor: boolean) {
    // Maybe the server should be the one to add this to the contract? Less decentralized but more secure
    // assert(this.txn.sender === this.deployer_address.value, 'Only the deployer can add votes to users');

    const voteTimestamp = globals.latestTimestamp;

    const userVotesCount: uint64 = this.user_votes(voterAddress).value;
    const userContribution: uint64 = this.user_contribution(voterAddress).value;

    // //Check if the user has opted in to the contract
    assert(!(userContribution === 0), 'User has not opted in to the contract');

    assert(this.proposals(proposalId).value.expiryTimestamp >= voteTimestamp, 'Proposal already expired');

    assert(
      !this.votes({ proposalId: proposalId, voterAddress: voterAddress }).exists,
      'User already voted on this proposal'
    );
    this.proposals(proposalId).value.proposalTotalVotes += 1;
    this.proposals(proposalId).value.proposalTotalPower += votingPower;
    if (inFavor) {
      this.proposals(proposalId).value.proposalYesVotes += 1;
      this.proposals(proposalId).value.proposalYesPower += votingPower;
    }
    this.user_votes(voterAddress).value += 1;
    // Save the vote adding the timestamp
    this.votes({ proposalId: proposalId, voterAddress: voterAddress }).value = { voteTimestamp: voteTimestamp };

    // Using numbers to make it easy - any vote made to an special proposal should be 1
    if (this.proposals(proposalId).value.proposalType === 1) {
      this.addOneToUserContribution(voterAddress);
      this.addOneToUserSpecialVotes(voterAddress);
    }
  }

  /**
   * Add one to the user contribution once it votes on a pool proposal
   * @param userAddress address of the user to add the contribution
   */
  private addOneToUserContribution(userAddress: Address) {
    // Maybe the server should be the one to add this to the contract? Less decentralized but more secure
    // assert(this.txn.sender === this.deployer_address.value, 'Only the deployer can add votes to users');

    //Check if the voter has a local state - optedin to the contract
    const userContribution: uint64 = this.user_contribution(userAddress).value;

    //Check if the user has opted in to the contract
    assert(userContribution >= 1, 'User has not opted in to the contract');
    this.user_contribution(userAddress).value += 1;
  }

  /**
   * Add one to the user contribution once it votes on a pool proposal
   * @param userAddress address of the user to add the special vote
   */
  private addOneToUserSpecialVotes(userAddress: Address) {
    // Maybe the server should be the one to add this to the contract? Less decentralized but more secure
    // assert(this.txn.sender === this.deployer_address.value, 'Only the deployer can add votes to users');

    //Check if the voter has a local state - optedin to the contract
    const userContribution: uint64 = this.user_contribution(userAddress).value;

    // //Check if the user has opted in to the contract
    // assert(userContribution >= 1, 'User has not opted in to the contract');

    this.user_special_votes(userAddress).value += 1;
  }

  /**
   * Add one to the user contribution once it votes on a pool proposal
   * @param proposalId The id of the proposal to be voted on
   * @param inFavor If the vote is a yes or no vote
   * @param voterAddress The address for the voter - Meant for v1.0 while deployer "server" will be responsible to execute
   */
  makeProposalVote(proposalId: ProposalIdType, inFavor: boolean, voterAddress: Address, votingPower: uint64) {
    assert(this.txn.sender === this.deployer_address.value, 'Only the deployer can add votes to users');
    // verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: 2_120 } });
    //Check if the proposal is still active
    this.addOneToUserVotes(voterAddress, proposalId, votingPower, inFavor);
  }

  /**
   * Add one to the user contribution once it votes on a pool proposal
   * @param userAddress The address of the user to get its contribution slashed
   * @param amount The amount to be slashed
   */
  slashUserContribution(userAddress: Address, amount: uint64) {
    const minContribution: uint64 = 1;

    assert(this.txn.sender === this.deployer_address.value, 'Only the deployer can slash user contribution');
    assert(
      this.user_contribution(userAddress).value > minContribution,
      'User does not have enough contribution to be slashed'
    );
    this.user_contribution(userAddress).value -= amount;
  }

  /**
   *
   * @param proposalId used to define state of proposals to return
   * @returns Returns active or expired proposals and its information
   */
  getProposalsById(proposalId: ProposalIdType): ProposalDataType {
    return this.proposals(proposalId).value;
  }
}
