// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title BallotSystem
 * @dev Implements a secure, transparent voting system for Project BALLOT.
 */
contract BallotSystem {

    // --- STRUCTS ---

    struct Candidate {
        uint id;
        string name;
        string party;
        uint voteCount;
    }

    struct Voter {
        bool isRegistered; // Is authorized by the AI/Admin layer
        bool hasVoted;     // Has cast a vote
        uint votedFor;     // ID of candidate voted for (kept for verification, see Note on Anonymity)
    }

    // --- STATE VARIABLES ---

    address public electionOfficial; // The admin/AI backend wallet
    string public electionName;
    
    // Mappings for O(1) access
    mapping(address => Voter) public voters;
    Candidate[] public candidates;
    
    // State management
    enum State { Created, Voting, Ended }
    State public electionState;

    // --- EVENTS ---
    // Events allow external apps to listen for real-time updates
    event VoterRegistered(address indexed voter);
    event VoteCasted(address indexed voter, uint candidateId);
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

    constructor(string memory _name) {
        electionOfficial = msg.sender;
        electionName = _name;
        electionState = State.Created;
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
     * @dev Starts the election.
     */
    function startElection() public onlyOfficial inState(State.Created) {
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

    /**
     * @dev Registers a voter. This is called by your Python/Node.js backend 
     * AFTER the AI Face Detection validates the ID.
     */
    function registerVoter(address _voterAddress) public onlyOfficial {
        require(electionState == State.Created || electionState == State.Voting, "Cannot register now");
        require(!voters[_voterAddress].isRegistered, "Voter already registered");

        voters[_voterAddress].isRegistered = true;
        emit VoterRegistered(_voterAddress);
    }

    // --- USER FUNCTIONS ---

    /**
     * @dev The core voting function.
     * @param _candidateId The index of the candidate in the array.
     */
    function vote(uint _candidateId) public inState(State.Voting) {
        Voter storage sender = voters[msg.sender];

        // 1. Security Checks
        require(sender.isRegistered, "You are not registered to vote");
        require(!sender.hasVoted, "You have already voted");
        require(_candidateId < candidates.length, "Invalid candidate ID");

        // 2. Update Voter State
        sender.hasVoted = true;
        sender.votedFor = _candidateId; 

        // 3. Update Candidate State (The Tally)
        candidates[_candidateId].voteCount++;

        // 4. Emit Event for Transparency
        emit VoteCasted(msg.sender, _candidateId);
    }

    // --- READ FUNCTIONS (TRANSPARENCY) ---

    function getCandidateCount() public view returns (uint) {
        return candidates.length;
    }

    /**
     * @dev Returns all details of a candidate including current vote count.
     */
    function getCandidate(uint _id) public view returns (uint, string memory, string memory, uint) {
        require(_id < candidates.length, "Invalid ID");
        Candidate memory c = candidates[_id];
        return (c.id, c.name, c.party, c.voteCount);
    }
    
    /**
     * @dev Returns the winner(s). Can handle ties by returning multiple if needed,
     * but this is a simple implementation returning the top one found first.
     */
    function getWinner() public view inState(State.Ended) returns (string memory winnerName, uint winnerVoteCount) {
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
}