import { Circle, Path } from "react-native-svg";

export function Valve() {
  return <>
    <Path fillRule="evenodd" d="M757 696A130 130 0 1 0 497 696A130 130 0 1 0 757 696ZM721 696A94 94 0 1 0 533 696A94 94 0 1 0 721 696Z" />
    <Path fillRule="evenodd" d="M609 572H646V651L660 659L720 623L739 655L678 690V706L739 741L720 773L660 737L646 745V823H609V745L595 737L534 773L516 741L577 706V690L516 655L534 623L595 659L609 651ZM648 697A21 21 0 1 0 606 697A21 21 0 1 0 648 697Z" />
    <Circle cx={627} cy={576} r={34} />
    <Circle cx={527} cy={635} r={35} />
    <Circle cx={727} cy={635} r={35} />
    <Circle cx={527} cy={755} r={35} />
    <Circle cx={727} cy={755} r={35} />
    <Circle cx={627} cy={810} r={34} />
  </>;
}
