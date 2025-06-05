# Theoretical Efficiency of PageRank-Enhanced Search

This guide presents the theoretical foundations and efficiency analysis of integrating PageRank into the Discord music bot's search pipeline.

## 1. PageRank Recap

PageRank models a random surfer on a directed graph of songs. The steady-state score $PR(i)$ for node $i$ satisfies:

$$
PR(i) = \frac{1 - d}{N} + d \sum_{j \in \mathrm{In}(i)} \frac{PR(j)}{|\mathrm{Out}(j)|}
$$

- $N$: total number of nodes (songs)
- $d$: damping factor (e.g. $0.85$)
- $0$ and $1$ represent link structure contributions

## 2. Iterative Complexity

Each PageRank iteration visits every edge and node, so one iteration costs:

$$
O(N + E)
$$

- $E$: total edges (relationships)

If full convergence requires $k$ iterations, total cost is:

$$
C_{\mathrm{full}} = k \times O(N + E)
$$

## 3. Convergence Bound

The number of iterations $k$ to reach tolerance $$ satisfies:

$$
k = O\Bigl(\frac{\ln(1/\u0003)}{1 - d}\Bigr)
$$

Relaxing the threshold ($\u0003 \approx 10^{-3}$) reduces $k$ while maintaining ranking quality.

## 4. Incremental vs Full Updates

When only a subset $S$ of nodes changes (“dirty nodes”), incremental PageRank restricts computation:

- Affected subgraph size: $|S|$ nodes, $E_S$ edges
- Iterations: $k' \le k$

Cost per update:

$$
C_{\mathrm{inc}} = k' \times O(|S| + E_S)
$$

Since $|S| \ll N$, we achieve a **speedup factor**:

$$
\text{Speedup} \approx \frac{k(N + E)}{k'( |S| + E_S)} \gg 1
$$

## 5. Caching Effects on Search

Search-time boosts use cached PageRank scores. Let cache hit probability be $h$. Then **expected** cost per query:

$$
\mathbb{E}[C_{\mathrm{query}}] = h \times O(1) + (1 - h) \times C_{\mathrm{inc/full}}
$$

High hit rates $(h \approx 0.8)$ push most queries to constant time.

## 6. Search Integration Overhead

Boosting $M$ search results by PageRank adds:

$$
O(M)
$$

Combined with aggregator overhead, total per-query cost:

$$
O(M) + \mathbb{E}[C_{\mathrm{query}}]
$$

Since $M \le 10$ is small, this remains dominated by caching and incremental update costs.

## 7. Summary of Theoretical Gains

| Aspect                         | Full PR         | Incremental PR      | Cached Search     |
|--------------------------------|-----------------|---------------------|-------------------|
| Complexity per update/query    | $O(k(N+E))$     | $O(k'(S+E_S))$      | $O(1)$ (hit)      |
| Iterations $k$                 | $O(\ln(1/\u0003)/(1-d))$ | $O(\ln(1/\u0003)/(1-d))$ | —                 |
| Typical speedup               | —               | $\approx N/S$       | —                 |
| Real-time search cost         | —               | —                   | $O(M)$            |

## 8. Implications for Large-Scale Search

- **Scalability**: Incremental updates avoid recomputing the full graph
- **Responsiveness**: Caching delivers near-instant boosts for repeat queries
- **Resource Efficiency**: Complexity reduction from $O(N+E)$ to $O(S + E_S)$ per update

By combining relaxed convergence, incremental computation, and caching, the bot achieves efficient, personalized search without sacrificing responsiveness. 