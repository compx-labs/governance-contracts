import { Contract } from '@algorandfoundation/tealscript';

type ProposalId = { nounce: uint64 };

type ProposalInfo = {
  creator_address: Address;
  total_votes: uint64;
  yes_votes: uint64;
  no_votes: uint64;
  timestamp: uint64;
  expiry_timestamp: uint64;
  proposal_title: string;
  proposal_description: string;
};

type ProposalVoteId = { proposal_id: uint64; voter_address: Address };
type ProposalVoteInfo = { vote_yes: boolean; voter_flux_power: uint64; timestamp: uint64 };

// -------------------------------------------------------------------------------------------------------------
//0.0025 Algo per box
//0.0004 per byte in the box
//Poll_mbr
// => (8) => (32 + 8 + 8 + 8 + 8 + 8 + 8 + 8) = 8 + 80 = (88 bits * 0.0004) + 0.00352 = 0.032 + 0.0025 = 0.03450

//Proposal MBR
const proposalMbr = 15_930;

export class CompxProposal extends Contract {
  total_votes = GlobalStateKey<uint64>;
  compx_governance_main_address = GlobalStateKey<Address>({ key: '' });

  proposal = BoxMap<ProposalId, ProposalInfo>({ prefix: 'pool_' });
  proposal_vote = BoxMap<ProposalId, ProposalInfo>({ prefix: 'pool_' });
}
