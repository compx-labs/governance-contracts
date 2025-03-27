import { Contract } from '@algorandfoundation/tealscript';
import { ProposalIdType, ProposalDataType, ProposalVoteDataType, ProposalVoteIdType } from './proposalConfig.algo';
import { PROPOSAL_MBR, VOTE_MBR } from './constants.algo';

export class CompxGovernance extends Contract {
  // Address of the manager of this contract
  manager_address = GlobalStateKey<Address>();

  // // Keeps track of the total number of proposals
  total_proposals = GlobalStateKey<uint64>();

  // // Keeps track of the total number of votes on all proposals
  total_votes = GlobalStateKey<uint64>();

  // // Total current voting power on the compx governance system - Gets added once per user after voting for the first time - used for participants to know onchain how much voting power is currently at stake
  total_current_voting_power = GlobalStateKey<uint64>();

  // Boxes to store proposal information
  proposals = BoxMap<ProposalIdType, ProposalDataType>({ prefix: '_p' });

  // Boxes to store proposal votes
  votes = BoxMap<ProposalVoteIdType, ProposalVoteDataType>({ prefix: '_v' });

  // User current voting power - Gets added once per user after voting for the first time and updated everytime a new vote is casted
  user_current_voting_power = LocalStateKey<uint64>();

  //User votes - Keeps track of the number of votes a user has created
  user_votes = LocalStateKey<uint64>();

  public createApplication() {
    this.manager_address.value = this.txn.sender;
    this.total_proposals.value = 0;
    this.total_current_voting_power.value = 0;
  }

  /**
   * OPT-IN to the application
   */

  public optInToApplication(): void {
    // Optin in to this contract will add 1 to the user contribution
    const userAddress: Address = this.txn.sender;
    this.user_votes(userAddress).value = 0;
    this.user_current_voting_power(userAddress).value = 0;
  }

  /**
   * Updates the
   * @param newManagerAddress The address of the new manager
   */

  public updateAppManager(newManagerAddress: Address): void {
    const sender: Address = this.txn.sender;

    //Only the current manager of teh contract can update the manager
    assert(sender === this.manager_address.value, 'User is trying to change the manager of the contractS');

    this.manager_address.value = newManagerAddress;
  }

  /**
   * Create a new proposal
   * @param proposalTitle Title of the proposal
   * @param proposalDescription Description of the proposal
   * @param expiresIn Time in seconds for the proposal to expire
   */

  public createNewProposal(proposalTitle: string, proposalDescription: string, expiresIn: uint64, mbrTxn: PayTxn) {
    const proposerAddress: Address = this.txn.sender;

    // The nonce of each proposal auto increments by 1
    const proposalNonce: uint64 = this.total_proposals.value + 1;
    const currentTimestamp: uint64 = globals.latestTimestamp;

    // Defines the expiry time of the proposal
    const expiryTimestamp: uint64 = currentTimestamp + expiresIn;

    // Only the manager can create proposals - We can change this so anyone can create a proposal
    assert(proposerAddress === this.manager_address.value, 'Only the manager can create proposals');
    assert(!this.proposals({ nonce: proposalNonce }).exists, 'Proposal already exists');

    // Contract account will need 2_912 microAlgos to create a proposal box
    verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: PROPOSAL_MBR } });

    // Create a new proposal with title and description and zero votes
    this.proposals({ nonce: proposalNonce }).value = {
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
  private recordUserVotes(
    voterAddress: Address,
    proposalId: ProposalIdType,
    votingPower: uint64,
    inFavor: boolean,
    mbrTxn: PayTxn
  ) {
    // Maybe the server should be the one to add this to the contract? Less decentralized but more secure
    assert(this.txn.sender === this.manager_address.value, 'Only the manager can add votes to users');

    verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: 2_120 } });

    const voteTimestamp = globals.latestTimestamp;

    assert(this.proposals(proposalId).value.expiryTimestamp >= voteTimestamp, 'Proposal already expired');

    //STOP if box with that vote already exists
    assert(
      this.votes({ proposalId: proposalId, voterAddress: voterAddress }).exists === false,
      'User already voted on this proposal'
    );

    //Check if the user is opted in to the contract before casting a vote - This is to prevent users from voting without opting in
    assert(voterAddress.isOptedInToApp(this.app.id), 'User has not opted in to the contract');

    this.proposals(proposalId).value.proposalTotalVotes += 1;
    this.proposals(proposalId).value.proposalTotalPower += votingPower;
    if (inFavor) {
      this.proposals(proposalId).value.proposalYesVotes += 1;
      this.proposals(proposalId).value.proposalYesPower += votingPower;
    }
    this.user_votes(voterAddress).value += 1;
    // Save the vote adding the timestamp
    this.votes({ proposalId: proposalId, voterAddress: voterAddress }).value = { voteTimestamp: voteTimestamp };

    this.total_votes.value += 1;
  }

  /**
   * Add one to the user contribution once it votes on a pool proposal
   * @param userAddress address of the user to add the contribution
   */

  /**
   * Add one to the user contribution once it votes on a pool proposal
   * @param userAddress address of the user to add the special vote
   * @param newVotingPower The voting power of the voter
   */
  public updateUserCurrentVotingPower(userAddress: Address, newVotingPower: uint64) {
    // Maybe the server should be the one to add this to the contract? Less decentralized but more secure
    assert(this.txn.sender === this.manager_address.value, 'Only the manager can add votes to users');
    const currentVotingPower: uint64 = this.user_current_voting_power(userAddress).value;
    this.user_current_voting_power(userAddress).value = newVotingPower;

    this.total_current_voting_power.value = newVotingPower + this.total_current_voting_power.value - currentVotingPower;
  }

  /**
   * Add one to the user contribution once it votes on a pool proposal
   * @param proposalId The id of the proposal to be voted on
   * @param inFavor If the vote is a yes or no vote
   * @param voterAddress The address for the voter - Meant for v1.0 while manager "server" will be responsible to execute
   * @param votingPower The voting power of the voter
   */
  makeProposalVote(
    proposalId: ProposalIdType,
    inFavor: boolean,
    voterAddress: Address,
    votingPower: uint64,
    mbrTxn: PayTxn
  ) {
    assert(this.txn.sender === this.manager_address.value, 'Only the manager can add votes to users');

    //Check if the MBR is enough to pay for creating a vote box
    verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: VOTE_MBR } });

    // Check if the proposal is still active
    this.updateUserCurrentVotingPower(voterAddress, votingPower);
    this.recordUserVotes(voterAddress, proposalId, this.user_current_voting_power(voterAddress).value, inFavor, mbrTxn);
  }

  /**
   * Add one to the user contribution once it votes on a pool proposal
   * @param userAddress The address of the user to get its contribution slashed
   * @param amount The amount to be slashed
   */
  slashUserVotingPower(userAddress: Address, amount: uint64) {
    assert(this.txn.sender === this.manager_address.value, 'Only the manager can slash user contribution');
    assert(this.user_current_voting_power(userAddress).value >= amount, 'User does not have enough voting power');
    this.user_current_voting_power(userAddress).value -= amount;
  }

  /**
   *
   * @param proposalId used to define state of proposals to return
   * @returns {ProposalDataType} Returns the proposal by id
   */
  getProposalsById(proposalId: ProposalIdType): ProposalDataType {
    return this.proposals(proposalId).value;
  }
}
