# CompX Governance Contract

## Overview
This contract implements a governance system on Algorand. It allows a deployer to create proposals, track votes, and update user voting power.

## Key Features
- **Deployment**  
  Initializes key global state variables and sets the deployer as the address authorized to create proposals and record user votes.
- **Opt-in**  
  Users must opt in to the contract before they can vote. This sets up local state to track each user’s vote data.
- **Proposal Creation**  
  The deployer can create proposals with an expiration and store details such as title and description.
- **Vote Recording**  
  The deployer records votes by mapping voter addresses to proposal IDs, while updating both total votes and voting power.
- **Voting Power Updates**  
  The contract keeps track of each user’s voting power and total voting power across the system.
- **Slashing**  
  The deployer can reduce a user’s voting power if necessary.

## How to Use
1. Deploy the contract with the deployer’s address.  
2. Have users opt in before they can vote.  
3. Create proposals by providing the proposal data and any required transaction for minimum balance.  
4. Cast votes by calling `makeProposalVote`, which records the vote and updates voting power.  
5. Slash user voting power if needed.

## Additional Notes
- The contract checks that enough microAlgos are sent with each proposal or vote to cover creation of box storage.  
- Only the deployer can create proposals and record votes.  
- Be sure to opt in before voting to avoid transaction failures.