pragma solidity 0.5.12;

import "./library/Pausable.sol";
import "./library/ERC20SafeTransfer.sol";
import "./library/SafeMath.sol";
import "./interface/IHNITokenController.sol";

contract Handler is ERC20SafeTransfer, Pausable {
    using SafeMath for uint256;
    bool private initialized; // Flags for initializing data
    address public HNITokenController; // HNIToken mapping contract

    mapping(address => bool) private tokensEnable; // Supports token or not

    event NewHNITokenAddresses(
        address indexed originalHNIToken,
        address indexed newHNIToken
    );
    event DisableToken(address indexed underlyingToken);
    event EnableToken(address indexed underlyingToken);

    // --- Init ---
    // This function is used with contract proxy, do not modify this function.
    function initialize(address _HNITokenController) public {
        require(!initialized, "initialize: Already initialized!");
        owner = msg.sender;
        HNITokenController = _HNITokenController;
        initialized = true;
    }

    /**
     * @dev Update HNIToken mapping contract.
     * @param _newHNITokenController The new HNIToken mapping contact.
     */
    function setHNITokenController(address _newHNITokenController) external auth {
        require(
            _newHNITokenController != HNITokenController,
            "setHNITokenController: The same HNIToken mapping contract address!"
        );
        address _originalHNITokenController = HNITokenController;
        HNITokenController = _newHNITokenController;
        emit NewHNITokenAddresses(
            _originalHNITokenController,
            _newHNITokenController
        );
    }

    /**
     * @dev Authorized function to disable some underlying tokens.
     * @param _underlyingTokens Tokens to disable.
     */
    function disableTokens(address[] calldata _underlyingTokens) external auth {
        for (uint256 i = 0; i < _underlyingTokens.length; i++) {
            _disableToken(_underlyingTokens[i]);
        }
    }

    /**
     * @dev Authorized function to enable some underlying tokens.
     * @param _underlyingTokens Tokens to enable.
     */
    function enableTokens(address[] calldata _underlyingTokens) external auth {
        for (uint256 i = 0; i < _underlyingTokens.length; i++) {
            _enableToken(_underlyingTokens[i]);
        }
    }

    function _disableToken(address _underlyingToken) internal {
        require(
            tokensEnable[_underlyingToken],
            "disableToken: Has been disabled!"
        );
        tokensEnable[_underlyingToken] = false;
        emit DisableToken(_underlyingToken);
    }

    function _enableToken(address _underlyingToken) internal {
        require(
            !tokensEnable[_underlyingToken],
            "enableToken: Has been enabled!"
        );
        tokensEnable[_underlyingToken] = true;
        emit EnableToken(_underlyingToken);
    }

    /**
     * @dev The _underlyingToken approves to HNIToken contract.
     * @param _underlyingToken Token address to approve.
     */
    function approve(address _underlyingToken, uint256 amount) public auth {
        address _HNIToken = IHNITokenController(HNITokenController).getHNIToken(
            _underlyingToken
        );

        require(
            doApprove(_underlyingToken, _HNIToken, amount),
            "approve: Approve HNIToken failed!"
        );
    }

    /**
     * @dev Support token or not.
     * @param _underlyingToken Token to check.
     */
    function tokenIsEnabled(address _underlyingToken)
        public
        view
        returns (bool)
    {
        return tokensEnable[_underlyingToken];
    }
}
