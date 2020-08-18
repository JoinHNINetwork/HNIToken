pragma solidity 0.5.12;

interface IHNITokenController {
    function getHNIToken(address _token) external view returns (address);
}
