import { ProposalIdType, ProposalDataType, ProposalVoteDataType, ProposalVoteIdType } from './proposalConfig.algo';
import {
  arc4,
  Contract,
  Global,
  GlobalState,
  gtxn,
  itxn,
  Txn,
  Account,
  assert,
  uint64,
  Application,
  BoxMap,
  LocalState,
  compile,
} from '@algorandfoundation/algorand-typescript';
import { TreasuryContract } from './CompxTreasury.algo';

export class CompxGovernance extends Contract {
  // Address of the manager of this contract
  manager_address = GlobalState<Account>();

  // // Keeps track of the total number of proposals
  total_proposals = GlobalState<uint64>();

  // // Keeps track of the total number of votes on all proposals
  total_votes = GlobalState<uint64>();

  treasury_app_id = GlobalState<Application>();

  // // Total current voting power on the compx governance system - Gets added once per user after voting for the first time - used for participants to know onchain how much voting power is currently at stake
  total_current_voting_power = GlobalState<uint64>();

  // Boxes to store proposal information
  proposals = BoxMap<ProposalIdType, ProposalDataType>({ keyPrefix: '_p' });

  // Boxes to store proposal votes
  votes = BoxMap<ProposalVoteIdType, ProposalVoteDataType>({ keyPrefix: '_v' });

  // User current voting power - Gets added once per user after voting for the first time and updated everytime a new vote is casted
  user_current_voting_power = LocalState<uint64>();

  public createApplication() {
    this.manager_address.value = Txn.sender;
    this.total_proposals.value = 0;
    this.total_current_voting_power.value = 0;
  }

  /**
   * OPT-IN to the application
   */

  public optInToApplication(): void {
    // Optin in to this contract will add 1 to the user contribution
    const userAddress: Account = Txn.sender;
    this.user_current_voting_power(userAddress).value = 0;
  }

  /**
   * Updates the
   * @param newManagerAddress The address of the new manager
   */

  public updateAppManager(newManagerAddress: Account): void {
    const sender: Account = Txn.sender;

    //Only the current manager of teh contract can update the manager
    assert(sender === this.manager_address.value, 'User is trying to change the manager of the contractS');

    this.manager_address.value = newManagerAddress;
  }

  createTreasury() {
    const compiled = compile(TreasuryContract);

    const appTxn = itxn
      .applicationCall({
        approvalProgram: compiled.approvalProgram,
        clearStateProgram: compiled.clearStateProgram,
        fee: 0,
        globalNumUint: 2, // <-- Allow 1 uint in global state,
        globalNumBytes: 2, // <-- Allow 0 byte slices in global state
      })
      .submit();

    // Store the created app ID in global state
    this.treasury_app_id.value = appTxn.createdApp;
  }

  setupTreasury() {
    itxn
      .applicationCall({
        appArgs: [
          arc4.methodSelector(TreasuryContract.prototype.setupManager),
          new arc4.Address(this.manager_address.value),
        ],
        appId: this.treasury_app_id.value,
        fee: 0,
      })
      .submit();
  }

  public depositAvailableAlgoIntoTreasury() {
    const contractMinBalance = Global.currentApplicationAddress.minBalance;
    const currentContractBalance = Global.currentApplicationAddress.balance;
    const amountToDeposit: uint64 = currentContractBalance - contractMinBalance;

    const paymentParams = itxn.payment({
      amount: amountToDeposit,
      receiver: this.treasury_app_id.value.address,
      fee: 0,
    });

    const appCallParams = itxn.applicationCall({
      appId: this.treasury_app_id.value,
      appArgs: [arc4.methodSelector(TreasuryContract.prototype.depositIntoTreasury)],
      fee: 0,
    });

    // Submit both as a group
    itxn.submitGroup(paymentParams, appCallParams);
  }

  /**
   * Create a new proposal
   * @param proposalTitle Title of the proposal
   * @param proposalDescription Description of the proposal
   * @param expiresIn Time in seconds for the proposal to expire
   */

  public createNewProposal(
    proposalTitle: string,
    proposalDescription: string,
    expiresIn: uint64,
    mbrTxn: gtxn.PaymentTxn
  ) {
    const proposerAddress: Account = Txn.sender;

    // The nonce of each proposal auto increments by 1
    const proposalNonce: uint64 = this.total_proposals.value + 1;
    const currentTimestamp: uint64 = Global.latestTimestamp;

    // Defines the expiry time of the proposal
    const expiryTimestamp: uint64 = currentTimestamp + expiresIn;

    // Only the manager can create proposals - We can change this so anyone can create a proposal
    assert(proposerAddress === this.manager_address.value, 'Only the manager can create proposals');
    assert(!this.proposals(new ProposalIdType({ nonce: new arc4.UintN64(1) })).exists, 'Proposal already exists');

    // // Contract account will need 2_912 microAlgos to create a proposal box
    // verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: PROPOSAL_MBR } });

    const newProposal = new ProposalDataType({
      proposalTitle: new arc4.Str(proposalTitle),
      proposalDescription: new arc4.Str(proposalDescription),
      proposalTotalVotes: new arc4.UintN64(0),
      proposalYesVotes: new arc4.UintN64(0),
      proposalTotalPower: new arc4.UintN64(0),
      proposalYesPower: new arc4.UintN64(0),

      createdAtTimestamp: new arc4.UintN64(currentTimestamp),
      expiryTimestamp: new arc4.UintN64(expiryTimestamp),
    });

    // Create a new proposal with title and description and zero votes
    this.proposals(new ProposalIdType({ nonce: new arc4.UintN64(this.total_proposals.value + 1) })).value = newProposal;

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
    voterAddress: Account,
    proposalId: ProposalIdType,
    votingPower: uint64,
    inFavor: boolean,
    mbrTxn: gtxn.PaymentTxn
  ) {
    assert(Txn.sender === this.manager_address.value, 'Only the manager can add votes to users');

    const voteTimestamp = Global.latestTimestamp;

    assert(this.proposals(proposalId).value.expiryTimestamp.native >= voteTimestamp, 'Proposal already expired');

    // STOP if box with that vote already exists
    assert(
      this.votes(new ProposalVoteIdType({ proposalId, voterAddress })).exists === false,
      'User already voted on this proposal'
    );

    // Update proposal vote counts and power
    const proposal = this.proposals(proposalId).value;
    proposal.proposalTotalVotes = proposal.proposalTotalVotes.add(new arc4.UintN64(1));
    proposal.proposalTotalPower = proposal.proposalTotalPower.add(new arc4.UintN64(votingPower));
    if (inFavor) {
      proposal.proposalYesVotes = proposal.proposalYesVotes.add(new arc4.UintN64(1));
      proposal.proposalYesPower = proposal.proposalYesPower.add(new arc4.UintN64(votingPower));
    }

    // Save the vote, using a struct instance
    this.votes(new ProposalVoteIdType({ proposalId, voterAddress })).value = new ProposalVoteDataType({
      voteTimestamp: new arc4.UintN64(voteTimestamp),
      votingPower: new arc4.UintN64(votingPower),
    });

    this.total_votes.value = this.total_votes.value += 1;
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
  public updateUserCurrentVotingPower(userAddress: Account, newVotingPower: uint64) {
    // Maybe the server should be the one to add this to the contract? Less decentralized but more secure
    assert(Txn.sender === this.manager_address.value, 'Only the manager can add votes to users');
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
    voterAddress: Account,
    votingPower: uint64,
    mbrTxn: gtxn.PaymentTxn
  ) {
    assert(Txn.sender === this.manager_address.value, 'Only the manager can add votes to users');

    //Check if the MBR is enough to pay for creating a vote box
    // verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: VOTE_MBR } });

    // Check if the proposal is still active
    this.updateUserCurrentVotingPower(voterAddress, votingPower);
    this.recordUserVotes(voterAddress, proposalId, this.user_current_voting_power(voterAddress).value, inFavor, mbrTxn);
  }

  /**
   * Add one to the user contribution once it votes on a pool proposal
   * @param userAddress The address of the user to get its contribution slashed
   * @param amount The amount to be slashed
   */
  slashUserVotingPower(userAddress: Account, amount: uint64) {
    assert(Txn.sender === this.manager_address.value, 'Only the manager can slash user contribution');
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
