pragma solidity 0.5.12;

import "./library/DSAuth.sol";

contract HNITokenController is DSAuth {
    bool private initialized; // Flags for initializing data

    mapping(address => address) internal HNITokens;

    event NewMappingHNIToken(
        address indexed token,
        address indexed mappingHNIToken
    );

    constructor() public {
        initialize();
    }

    // --- Init ---
    // This function is used with contract proxy, do not modify this function.
    function initialize() public {
        require(!initialized, "initialize: Already initialized!");
        owner = msg.sender;
        initialized = true;
    }

    /**
     *  @dev Adds new mapping: token => HNIToken.
     */
    function setHNITokensRelation(
        address[] memory _tokens,
        address[] memory _mappingHNITokens
    ) public auth {
        require(
            _tokens.length == _mappingHNITokens.length,
            "setHNITokensRelation: Array length do not match!"
        );
        for (uint256 i = 0; i < _tokens.length; i++) {
            _setHNITokenRelation(_tokens[i], _mappingHNITokens[i]);
        }
    }

    function _setHNITokenRelation(address _token, address _mappingHNIToken)
        internal
    {
        require(
            HNITokens[_token] == address(0x0),
            "_setHNITokenRelation: Has set!"
        );
        HNITokens[_token] = _mappingHNIToken;
        emit NewMappingHNIToken(_token, _mappingHNIToken);
    }

    /**
     * @dev Updates existing mapping: token => HNIToken.
     */
    function updatedTokenRelation(address _token, address _mappingHNIToken)
        external
        auth
    {
        require(
            HNITokens[_token] != address(0x0),
            "updatedTokenRelation: token does not exist!"
        );
        HNITokens[_token] = _mappingHNIToken;
        emit NewMappingHNIToken(_token, _mappingHNIToken);
    }

    function getHNIToken(address _token) external view returns (address) {
        return HNITokens[_token];
    }
}
