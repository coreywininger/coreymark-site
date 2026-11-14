// CIDR parsing and address math for the subnet calculator.
// Used by /lab/subnet/ and by the live widget on the homepage. Pure functions,
// no DOM access. Addresses are BigInt so IPv4 and IPv6 share one code path.

export interface Arpa {
  zone: string;
  exact: boolean;
}

export interface CidrResult {
  error?: undefined;
  family: 4 | 6;
  total: number;
  prefix: number;
  hostBits: number;
  network: bigint;
  lastAddr: bigint;
  totalAddrs: bigint;
  mask: bigint;
  firstUsable: bigint;
  lastUsable: bigint;
  usableHosts: bigint;
  arpa: Arpa;
  canonical: string;
  /** IPv4 only. */
  wildcard?: bigint;
  /** IPv4 only. */
  ipClass?: 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface CidrError {
  error: string;
}

export function ipv4ToBig(ip: string): bigint | null {
  var parts = ip.split('.');
  if (parts.length !== 4) return null;
  var n = 0n;
  for (var i = 0; i < 4; i++) {
    var p = parseInt(parts[i], 10);
    if (isNaN(p) || p < 0 || p > 255 || String(p) !== parts[i].replace(/^0+(?=\d)/, '')) return null;
    n = (n << 8n) | BigInt(p);
  }
  return n;
}
export function bigToIpv4(n: bigint): string {
  return [
    Number((n >> 24n) & 0xffn),
    Number((n >> 16n) & 0xffn),
    Number((n >> 8n) & 0xffn),
    Number(n & 0xffn)
  ].join('.');
}
export function ipv6ToBig(addr: string): bigint | null {
  if (!/^[0-9a-fA-F:]+$/.test(addr) || (addr.match(/::/g) || []).length > 1) return null;
  var parts: string[];
  if (addr.indexOf('::') !== -1) {
    var halves = addr.split('::');
    var left = halves[0] === '' ? [] : halves[0].split(':');
    var right = halves[1] === '' ? [] : halves[1].split(':');
    var missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    var middle: string[] = [];
    for (var i = 0; i < missing; i++) middle.push('0');
    parts = left.concat(middle).concat(right);
  } else {
    parts = addr.split(':');
  }
  if (parts.length !== 8) return null;
  var n = 0n;
  for (var j = 0; j < 8; j++) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(parts[j])) return null;
    n = (n << 16n) | BigInt(parseInt(parts[j], 16));
  }
  return n;
}
export function bigToIpv6(n: bigint): string {
  var groups: string[] = [];
  for (var i = 7; i >= 0; i--) {
    groups.push(((n >> BigInt(i * 16)) & 0xffffn).toString(16));
  }
  var bestStart = -1, bestLen = 0;
  var curStart = -1, curLen = 0;
  for (var k = 0; k < 8; k++) {
    if (groups[k] === '0') {
      if (curStart === -1) { curStart = k; curLen = 1; } else { curLen++; }
      if (curLen > bestLen) { bestStart = curStart; bestLen = curLen; }
    } else {
      curStart = -1; curLen = 0;
    }
  }
  if (bestLen >= 2) {
    var before = groups.slice(0, bestStart).join(':');
    var after = groups.slice(bestStart + bestLen).join(':');
    return (before || '') + '::' + (after || '');
  }
  return groups.join(':');
}

export function arpaV4(network: bigint, prefix: number): Arpa {
  var n = network;
  var octets = [
    Number((n >> 24n) & 0xffn),
    Number((n >> 16n) & 0xffn),
    Number((n >> 8n) & 0xffn),
    Number(n & 0xffn)
  ];
  var alignedOctets = Math.floor(prefix / 8);
  if (alignedOctets === 0) return { zone: 'in-addr.arpa', exact: prefix === 0 };
  var rev = octets.slice(0, alignedOctets).reverse();
  return { zone: rev.join('.') + '.in-addr.arpa', exact: prefix % 8 === 0 };
}
export function arpaV6(network: bigint, prefix: number): Arpa {
  var nibbles: string[] = [];
  for (var i = 31; i >= 0; i--) {
    nibbles.push(((network >> BigInt(i * 4)) & 0xfn).toString(16));
  }
  var alignedNibbles = Math.floor(prefix / 4);
  if (alignedNibbles === 0) return { zone: 'ip6.arpa', exact: prefix === 0 };
  var rev = nibbles.slice(0, alignedNibbles).reverse();
  return { zone: rev.join('.') + '.ip6.arpa', exact: prefix % 4 === 0 };
}

export function parseCidr(text: string): CidrResult | CidrError {
  var t = text.trim();
  var slash = t.lastIndexOf('/');
  if (slash === -1) return { error: 'Missing prefix (e.g. /24 or /64)' };
  var addrPart = t.slice(0, slash);
  var prefixPart = t.slice(slash + 1);
  var prefix = parseInt(prefixPart, 10);
  if (isNaN(prefix)) return { error: 'Prefix must be a number' };

  var family: 4 | 6, total: number, addr: bigint | null;
  if (addrPart.indexOf(':') !== -1) {
    family = 6; total = 128;
    addr = ipv6ToBig(addrPart);
    if (addr === null) return { error: 'Invalid IPv6 address' };
  } else {
    family = 4; total = 32;
    addr = ipv4ToBig(addrPart);
    if (addr === null) return { error: 'Invalid IPv4 address' };
  }
  if (prefix < 0 || prefix > total) return { error: 'Prefix must be 0–' + total + ' for IPv' + family };

  var hostBits = total - prefix;
  var allOnes = (1n << BigInt(total)) - 1n;
  var mask = prefix === 0 ? 0n : ((allOnes >> BigInt(hostBits)) << BigInt(hostBits));
  var network = addr & mask;
  var lastAddr = network | ((1n << BigInt(hostBits)) - 1n);
  var totalAddrs = 1n << BigInt(hostBits);

  var result: CidrResult = {
    family: family, total: total, prefix: prefix, hostBits: hostBits,
    network: network, lastAddr: lastAddr, totalAddrs: totalAddrs, mask: mask,
    firstUsable: network, lastUsable: lastAddr, usableHosts: totalAddrs,
    arpa: { zone: '', exact: false }, canonical: '',
  };

  if (family === 4) {
    result.wildcard = (~mask) & allOnes;
    var firstOctet = Number((addr >> 24n) & 0xffn);
    result.ipClass = firstOctet < 128 ? 'A' : firstOctet < 192 ? 'B' : firstOctet < 224 ? 'C' : firstOctet < 240 ? 'D' : 'E';
    if (prefix === 32) { result.firstUsable = network; result.lastUsable = network; result.usableHosts = 1n; }
    else if (prefix === 31) { result.firstUsable = network; result.lastUsable = lastAddr; result.usableHosts = 2n; }
    else { result.firstUsable = network + 1n; result.lastUsable = lastAddr - 1n; result.usableHosts = totalAddrs - 2n; }
    result.arpa = arpaV4(network, prefix);
    result.canonical = bigToIpv4(network) + '/' + prefix;
  } else {
    result.usableHosts = totalAddrs;
    result.firstUsable = network;
    result.lastUsable = lastAddr;
    result.arpa = arpaV6(network, prefix);
    result.canonical = bigToIpv6(network) + '/' + prefix;
  }
  return result;
}

export function fmtAddr(n: bigint, family: 4 | 6): string { return family === 6 ? bigToIpv6(n) : bigToIpv4(n); }

export function fmtBigCount(n: bigint): string {
  if (n <= 1000000n) return n.toLocaleString();
  var s = n.toString();
  var exp = s.length - 1;
  var mantissa = (Number(s.slice(0, 4)) / 1000).toFixed(2);
  return mantissa + ' × 10^' + exp + ' (' + s.length + ' digits)';
}

