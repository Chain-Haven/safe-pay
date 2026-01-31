// @safe-pay/providers - Swap provider implementations
// 
// This package provides a modular interface for crypto swap providers.
// Currently supports: Exolix, FixedFloat
// 
// To add a new provider:
// 1. Create a new class in /providers/ implementing ISwapProvider
// 2. Register it in providerRegistry below
// 3. The rate shopping system will automatically include it

export * from './interfaces';
export * from './providers/exolix';
export * from './providers/fixedfloat';
export * from './rate-shopper';
export * from './registry';
