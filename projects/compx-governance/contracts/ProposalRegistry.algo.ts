import { Contract } from '@algorandfoundation/tealscript';

type RegistryProposalId = { proposal_id: uint64 };

type RegistryProposalInfo = {
  start_date: uint64;
  expiry_date: uint64;
};

export class CompxProposalRegistry extends Contract {
  registered_proposals = BoxMap<RegistryProposalId, RegistryProposalInfo>({
    prefix: 'reg_proposal_',
  });

  compx_proposal_contract = GlobalStateKey<AppID>();

  //   createApplication(): void {
  //     // Only allow deployment once, without restrictions
  //   }

  //   registerProposal(proposal_id: uint64, start_date: uint64, expiry_date: uint64): void {
  //     // Ensure only the main proposal contract can register
  //     assert(this.txn.sender === this.compx_proposal_contract.value, 'Only the proposal contract can register');

  //     const proposalData: RegistryProposalInfo = { start_date, expiry_date };

  //     this.registered_proposals({ proposal_id: proposal_id }).value = proposalData;
  //   }

  registerProposal(appId: AppID) {
    this.compx_proposal_contract.value = appId;
  }
}
