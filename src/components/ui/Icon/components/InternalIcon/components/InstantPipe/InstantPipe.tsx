import { Path, Rect } from "react-native-svg";

export function InstantPipe() {
  return <>
    <Rect x={251} y={493} width={132} height={343} rx={43} />
    <Rect x={871} y={493} width={132} height={343} rx={43} />
    <Path fillRule="evenodd" d="M398 543H856V786H398ZM487 640C448 640 448 698 487 698H673V732C673 744 681 749 692 740L773 680Q788 668 773 655L692 594C681 585 673 590 673 602V640Z" />
  </>;
}
