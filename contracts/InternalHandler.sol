pragma solidity 0.5.12;

import "./Handler.sol";

contract InternalHandler is Handler {
    constructor(address _HNITokenController) public {
        super.initialize(_HNITokenController);
    }

    /**
     * @dev Deposit token to market, only called by HNIToken contract.
     * @param _underlyingToken Token to deposit.
     * @return The actual deposited token amount.
     */
    function deposit(address _underlyingToken, uint256 _amount)
        external
        view
        whenNotPaused
        auth
        returns (uint256)
    {
        require(
            tokenIsEnabled(_underlyingToken),
            "deposit: Token is disabled!"
        );
        return _amount;
    }

    /**
     * @dev Withdraw token from market, but only for HNIToken contract.
     * @param _underlyingToken Token to withdraw.
     * @param _amount Token amount to withdraw.
     * @return The actual withdrown token amount.
     */
    function withdraw(address _underlyingToken, uint256 _amount)
        external
        view
        whenNotPaused
        auth
        returns (uint256)
    {
        return
            _amount == uint256(-1)
                ? IERC20(_underlyingToken).balanceOf(address(this))
                : _amount;
    }

    /**
     * @dev Total balance with any accumulated interest for `_underlyingToken` belonging to `handler`.
     * @param _underlyingToken Token to get balance.
     */
    function getRealBalance(address _underlyingToken)
        public
        view
        returns (uint256)
    {
        return IERC20(_underlyingToken).balanceOf(address(this));
    }

    /**
     * @dev The maximum withdrawable amount of token `_underlyingToken` in the market.
     * @param _underlyingToken Token to get liquidity.
     */
    function getRealLiquidity(address _underlyingToken)
        public
        view
        returns (uint256)
    {
        return IERC20(_underlyingToken).balanceOf(address(this));
    }

    /***************************************************/
    /*** View Interfaces For Backwards compatibility ***/
    /***************************************************/

    /**
     * @dev Total balance with any accumulated interest for `_underlyingToken` belonging to `handler`.
     * @param _underlyingToken Token to get balance.
     */
    function getBalance(address _underlyingToken)
        external
        view
        returns (uint256)
    {
        return getRealBalance(_underlyingToken);
    }

    /**
     * @dev The maximum withdrawable amount of token `_underlyingToken` in the market.
     * @param _underlyingToken Token to get liquidity.
     */
    function getLiquidity(address _underlyingToken)
        external
        view
        returns (uint256)
    {
        return getRealLiquidity(_underlyingToken);
    }
}
