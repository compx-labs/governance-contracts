import { Contract } from '@algorandfoundation/tealscript';

type ProposalId = { nounce: uint64 };

type ProposalInfo = {
  total_votes: uint64;
  yes_votes: uint64;
  timestamp: uint64;
  expiry_timestamp: uint64;
  proposal_title: string;
  proposal_description: string;
};

type ProposalVoteId = { voter_address: Address };
type ProposalVoteInfo = { vote_yes: boolean };

//Vote mbr
//(32)=>8 - total_bits = 40 bits - mbr_value = (40 bits * 0.0004) + 0.00352 = 0.01952

const vote_mbr = 1_952;

export class CompxProposal extends Contract {
  compx_governance_address = GlobalStateKey<Address>({
    key: 'TGIPEOKUFC5JFTPFMXGSZWOGOFA7THFZXUTRLQEOH3RD3LGI6QEEWJNML4',
  });
  total_votes = GlobalStateKey<uint64>();
  compx_governance_main_address = GlobalStateKey<Address>();
  proposal_title = GlobalStateKey<string>();
  proposal_description = GlobalStateKey<string>();
  expiry_timestamp = GlobalStateKey<uint64>();
  created_at = GlobalStateKey<uint64>();
  yes_votes = GlobalStateKey<uint64>();

  vote = BoxMap<ProposalVoteId, ProposalVoteInfo>();

  createApplication(proposalTitle: string, proposalDescription: string, expires_in: uint64): void {
    // assert(this.txn.sender === this.compx_governance_main_address.value, 'Only governance can create proposal');

    this.total_votes.value = 0;
    this.yes_votes.value = 0;
    this.proposal_title.value = proposalTitle;
    this.proposal_description.value = proposalDescription;
    this.expiry_timestamp.value = globals.latestTimestamp + expires_in;
    this.created_at.value = globals.latestTimestamp;
    // const appId: AppID = AppID.fromUint64(this.app.id);

    // sendMethodCall<[uint64, uint64, uint64], bytes>({
    //   name: 'registerProposal',
    //   methodArgs: [420420420, 1000, 1000],
    //   applicationID: AppID.fromUint64(735052553),
    //   fee: 1,
    // });
  }

  public createProposal(proposalTitle: string, proposalDescription: string, expires_in: uint64): void {}

  public makeProposalVote(mbrTxn: PayTxn, voteYes: boolean): void {
    //Check if the MBR transaction is being sent to the contract address
    assert(mbrTxn.receiver === this.app.address, 'Invalid receiver');

    //Check if the method call is correctly being sent to the contract address

    const voterAddress: Address = this.txn.sender;

    //Check if MBR transaction is enough in order to create the vote box
    verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: vote_mbr } });

    //Check if user haven't already voted
    assert(!this.vote({ voter_address: voterAddress }).exists, 'Already voted');

    //Check if proposal is still active
    assert(globals.latestTimestamp < this.expiry_timestamp.value, 'Proposal expired');

    //Assure its not compx governance address voting
    // assert(this.txn.sender != this.compx_governance_address.value, 'Compx address cannot vote to this proposal');

    this.vote({ voter_address: voterAddress }).value = { vote_yes: voteYes };

    this.total_votes.value += 1;
    if (voteYes) {
      this.yes_votes.value += 1;
    }
  }
}
