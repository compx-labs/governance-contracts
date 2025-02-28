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
    assert(this.txn.sender === this.compx_governance_main_address.value, 'Only governance can create proposal');

    this.total_votes.value = 0;
    this.yes_votes.value = 0;
    this.proposal_title.value = proposalTitle;
    this.proposal_description.value = proposalDescription;
    this.expiry_timestamp.value = globals.latestTimestamp + expires_in;
    this.created_at.value = globals.latestTimestamp;
  }

  voteProposal(voteYes: boolean, mbrTxn: PayTxn): void {
    assert(globals.latestTimestamp < this.expiry_timestamp.value, 'Proposal has expired');
    assert(!this.vote({ voter_address: this.txn.sender }).exists, 'User Already voted');
    if (voteYes) {
      this.yes_votes.value += 1;
    }
  }
}
