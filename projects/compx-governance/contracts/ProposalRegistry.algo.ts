import { Contract } from '@algorandfoundation/tealscript';

type RegistryProposalId = { proposal_id: AppID };

type RegistryProposalInfo = {
  start_timestamp: uint64;
  expiry_timestamp: uint64;
};

const proposalRegistryMbr = 1_000;

export class CompxProposalRegistry extends Contract {
  compx_governance_address = GlobalStateKey<Address>();

  registered_proposals = BoxMap<RegistryProposalId, RegistryProposalInfo>({
    prefix: 'reg_proposal_',
  });

  createApplication(): void {
    this.compx_governance_address.value = this.txn.sender;
  }

  registerProposal(appId: AppID, mbrTxn: PayTxn, start_timestamp: uint64, expiry_timestamp: uint64) {
    //This assert is only used if we make the app call to register the new proposal manually
    //assert(this.txn.sender === this.compx_governance_address.value, 'Only the compx governance address can register a new proposal to this registry')
    // const proposalAddress: Address = this.txn.sender;

    //Assert that the mbrTxn is enough to cover the creation of the proposal box into the registry
    verifyPayTxn(mbrTxn, { amount: { greaterThanEqualTo: proposalRegistryMbr } });

    //Assert that the current register being created into the registry does not already exists
    assert(!this.registered_proposals({ proposal_id: appId }).exists);
    this.registered_proposals({ proposal_id: appId }).value = {
      start_timestamp: start_timestamp,
      expiry_timestamp: expiry_timestamp,
    };
  }
}
