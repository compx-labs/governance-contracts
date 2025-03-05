import { ProposalIdType, ProposalDataType } from './proposalConfig.algo';

import { Contract } from '@algorandfoundation/tealscript';
export class CompxGovernance extends Contract {
  // Address of the deployer of this contract
  deployer_address = GlobalStateKey<Address>();

  // // Keeps track of the total number of proposals
  total_proposals = GlobalStateKey<uint64>();

  // Boxes to store proposal information
  proposals = BoxMap<ProposalIdType, ProposalDataType>();

  public createApplication() {
    this.total_proposals.value = 0;
    this.deployer_address.value = this.txn.sender;
    this.total_proposals.value = 0;
  }

  /**
   * Create a new proposal
   * @param proposalTitle Title of the proposal
   * @param proposalDescription Description of the proposal
   * @param expiresIn Time in seconds for the proposal to expire
   */

  public createNewProposal(proposalTitle: string, proposalDescription: string, expiresIn: uint64) {
    const proposerAddress: Address = this.txn.sender;
    //The nonce of each proposal auto increments by 1
    const proposalNonce: uint64 = this.total_proposals.value + 1;
    const currentTimestamp: uint64 = globals.latestTimestamp;
    //Defines the expiry time of the proposal
    const expiryTimestamp: uint64 = currentTimestamp + expiresIn;
    // Only the deployer can create proposals - We can change this so anyone can create a proposal
    assert(proposerAddress === this.deployer_address.value, 'Only the deployer can create proposals');
    assert(!this.proposals({ nonce: proposalNonce }).exists, 'Proposal already exists');
    // Create a new proposal with title and description and zero votes
    this.proposals({ nonce: proposalNonce }).value = {
      proposalTitle: proposalTitle,
      proposalDescription: proposalDescription,
      ProposalTotalVotes: 0,
      ProposalYesVotes: 0,
      CreatedAtTimestamp: currentTimestamp,
      ExpiryTimestamp: expiryTimestamp,
    };
  }

  //   /**
  //    *
  //    * @param proposalState used to define state of proposals to return
  //    * @returns Returns active or expired proposals and its information
  //    */
  //   getProposalsCounter(proposalState: string): uint64[] {
  //     return [];
  //   }
}
