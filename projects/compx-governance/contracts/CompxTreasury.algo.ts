

export class TreasuryContract extends Contract {
  manager_contract_address = GlobalState<Account>();
  governance_fee_sink = GlobalState<uint64>();
  treasury_witrdrawal_address = GlobalState<arc4.Address>();

  // Setup the manager of the treasury
  setupManager(treasuryWithdrawalAddress: arc4.Address) {
    const manager = Txn.sender;
    this.manager_contract_address.value = manager;
    this.treasury_witrdrawal_address.value = treasuryWithdrawalAddress;
    this.governance_fee_sink.value = 0;
  }

  // Deposit into treasury

  depositIntoTreasury(depositPayment: gtxn.PaymentTxn) {
    assert(
      depositPayment.receiver === Global.currentApplicationAddress,
      'Deposit payment must be sent to the treasury contract'
    );

    assert(depositPayment.amount > 0, 'Deposit amount must be greater than 0');

    this.governance_fee_sink.value += depositPayment.amount;
  }

  // Withdraw from treasury
  withdrawTreasuryFunds() {
    assert(
      Txn.sender === this.treasury_witrdrawal_address.value.native,
      'Only the treasury withdrawal address can withdraw funds'
    );

    const minContractBalance: uint64 = Global.currentApplicationAddress.minBalance;
    const currentContractBalance: uint64 = Global.currentApplicationAddress.balance;
    const availableWithdrawableAmount: uint64 = currentContractBalance - minContractBalance;

    itxn
      .payment({ amount: availableWithdrawableAmount, receiver: this.treasury_witrdrawal_address.value.native })
      .submit();
  }
}
