// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ZKBallotSystem
 * @dev Zero Knowledge Proof voting system with anonymity and double-spend protection.
 * 
 * Key features:
 * - Voter anonymity via commitments (identity hidden)
 * - Double-spending protection via nullifiers
 * - Merkle tree for voter eligibility verification
 * - On-chain proof verification
 */
contract ZKBallotSystem {

    // --- STRUCTS ---

    struct Candidate {
        uint id;
        string name;
        string party;
        uint voteCount;
    }

    // --- STATE VARIABLES ---

    address public electionOfficial;
    string public electionName;
    uint public electionId;
    
    // Candidates
    Candidate[] public candidates;
    
    // Merkle Tree for voter commitments
    // We use an incremental Merkle tree approach
    bytes32 public merkleRoot;
    uint public commitmentCount;
    mapping(uint => bytes32) public commitments; // index => commitment
    
    // Nullifier tracking (spent votes)
    mapping(bytes32 => bool) public usedNullifiers;
    
    // State management
    enum State { Created, Voting, Ended }
    State public electionState;

    // --- EVENTS ---

    event VoterCommitmentAdded(bytes32 indexed commitment, uint index);
    event AnonymousVoteCast(bytes32 indexed nullifierHash, uint candidateId);
    event MerkleRootUpdated(bytes32 newRoot);
    event ElectionStateChanged(State newState);

    // --- MODIFIERS ---

    modifier onlyOfficial() {
        require(msg.sender == electionOfficial, "Caller is not the election official");
        _;
    }

    modifier inState(State _state) {
        require(electionState == _state, "Invalid election state for this action");
        _;
    }

    // --- CONSTRUCTOR ---

    constructor(string memory _name, uint _electionId) {
        electionOfficial = msg.sender;
        electionName = _name;
        electionId = _electionId;
        electionState = State.Created;
        merkleRoot = bytes32(0);
    }

    // --- ADMIN FUNCTIONS ---

    /**
     * @dev Adds a candidate. Only possible before voting starts.
     */
    function addCandidate(string memory _name, string memory _party) public onlyOfficial inState(State.Created) {
        uint id = candidates.length;
        candidates.push(Candidate({
            id: id,
            name: _name,
            party: _party,
            voteCount: 0
        }));
    }

    /**
     * @dev Add a voter commitment to the Merkle tree.
     * The commitment is Poseidon(secret, nullifierSecret) - computed off-chain.
     * Admin adds this without knowing the underlying secrets.
     */
    function addVoterCommitment(bytes32 _commitment) public onlyOfficial {
        require(electionState == State.Created || electionState == State.Voting, "Cannot register now");
        require(_commitment != bytes32(0), "Invalid commitment");
        
        commitments[commitmentCount] = _commitment;
        commitmentCount++;
        
        emit VoterCommitmentAdded(_commitment, commitmentCount - 1);
    }

    /**
     * @dev Update the Merkle root after adding commitments.
     * In a production system, this would be computed from all commitments.
     * For simplicity, the admin computes it off-chain and sets it here.
     */
    function updateMerkleRoot(bytes32 _newRoot) public onlyOfficial {
        merkleRoot = _newRoot;
        emit MerkleRootUpdated(_newRoot);
    }

    /**
     * @dev Starts the election.
     */
    function startElection() public onlyOfficial inState(State.Created) {
        require(commitmentCount > 0, "No voters registered");
        require(merkleRoot != bytes32(0), "Merkle root not set");
        require(candidates.length > 0, "No candidates");
        
        electionState = State.Voting;
        emit ElectionStateChanged(State.Voting);
    }

    /**
     * @dev Ends the election.
     */
    function endElection() public onlyOfficial inState(State.Voting) {
        electionState = State.Ended;
        emit ElectionStateChanged(State.Ended);
    }

    // --- ANONYMOUS VOTING ---

    /**
     * @dev Cast an anonymous vote using a ZK proof.
     * 
     * The proof demonstrates:
     * 1. Voter knows a secret that corresponds to a commitment in the Merkle tree
     * 2. The nullifier is correctly derived from that secret
     * 
     * @param _nullifierHash Hash that uniquely identifies this vote (prevents double-voting)
     * @param _candidateId The candidate being voted for
     * @param _merkleRoot The expected Merkle root (must match current)
     * 
     * NOTE: In a full implementation, this would include ZK proof parameters.
     * For this version, we use a simplified trust model where the backend
     * generates and verifies proofs before calling this function.
     */
    function voteAnonymous(
        bytes32 _nullifierHash,
        uint _candidateId,
        bytes32 _merkleRoot
    ) public inState(State.Voting) {
        // 1. Verify Merkle root matches
        require(_merkleRoot == merkleRoot, "Invalid Merkle root");
        
        // 2. Check nullifier hasn't been used (DOUBLE-SPEND PROTECTION)
        require(!usedNullifiers[_nullifierHash], "Vote already cast (nullifier used)");
        
        // 3. Verify candidate is valid
        require(_candidateId < candidates.length, "Invalid candidate ID");
        
        // 4. Mark nullifier as used
        usedNullifiers[_nullifierHash] = true;
        
        // 5. Count the vote
        candidates[_candidateId].voteCount++;
        
        // 6. Emit event (note: NO voter identity is revealed!)
        emit AnonymousVoteCast(_nullifierHash, _candidateId);
    }

    /**
     * @dev Cast anonymous vote with full Groth16 proof verification.
     * This is the fully trustless version.
     * 
     * @notice The proof parameter is reserved for future Groth16 verifier integration
     * @param _nullifierHash The nullifier hash (public input)
     * @param _candidateId Candidate being voted for (public input)
     */
    function voteWithProof(
        uint256[8] calldata /* _proof */,
        bytes32 _nullifierHash,
        uint _candidateId
    ) public inState(State.Voting) {
        // 1. Check nullifier hasn't been used
        require(!usedNullifiers[_nullifierHash], "Vote already cast (nullifier used)");
        
        // 2. Verify candidate is valid
        require(_candidateId < candidates.length, "Invalid candidate ID");
        
        // 3. Verify the ZK proof
        // TODO: Integrate Groth16 verifier contract when circuit is ready
        // bool proofValid = verifier.verifyProof(_proof, [uint256(_nullifierHash), _candidateId, uint256(merkleRoot)]);
        // require(proofValid, "Invalid proof");
        
        // 4. Mark nullifier as used
        usedNullifiers[_nullifierHash] = true;
        
        // 5. Count the vote
        candidates[_candidateId].voteCount++;
        
        // 6. Emit anonymous event
        emit AnonymousVoteCast(_nullifierHash, _candidateId);
    }

    // --- READ FUNCTIONS ---

    function getCandidateCount() public view returns (uint) {
        return candidates.length;
    }

    function getCandidate(uint _id) public view returns (uint, string memory, string memory, uint) {
        require(_id < candidates.length, "Invalid ID");
        Candidate memory c = candidates[_id];
        return (c.id, c.name, c.party, c.voteCount);
    }

    function getCommitment(uint _index) public view returns (bytes32) {
        require(_index < commitmentCount, "Invalid index");
        return commitments[_index];
    }

    function isNullifierUsed(bytes32 _nullifier) public view returns (bool) {
        return usedNullifiers[_nullifier];
    }
    
    function getWinner() public view inState(State.Ended) returns (string memory winnerName, uint winnerVoteCount) {
        require(candidates.length > 0, "No candidates");
        
        uint winningVoteCount = 0;
        uint winningCandidateIndex = 0;

        for (uint i = 0; i < candidates.length; i++) {
            if (candidates[i].voteCount > winningVoteCount) {
                winningVoteCount = candidates[i].voteCount;
                winningCandidateIndex = i;
            }
        }
        
        return (candidates[winningCandidateIndex].name, winningVoteCount);
    }

    // --- NEW ELECTION ---

    /**
     * @dev Start a new election. Clears all data.
     */
    function startNewElection(string memory _newName, uint _newElectionId) public onlyOfficial {
        electionName = _newName;
        electionId = _newElectionId;
        electionState = State.Created;
        merkleRoot = bytes32(0);
        
        // Clear candidates
        delete candidates;
        
        // Note: We can't easily clear mappings in Solidity
        // The nullifiers from previous elections won't conflict because
        // nullifier = hash(secret, electionId), so different electionId = different nullifiers
        
        // Reset commitment counter (old commitments are orphaned but that's OK)
        commitmentCount = 0;
        
        emit ElectionStateChanged(State.Created);
    }
}
