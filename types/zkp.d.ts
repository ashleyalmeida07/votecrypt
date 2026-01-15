// Type declarations for circomlibjs
declare module 'circomlibjs' {
    export interface Poseidon {
        (inputs: bigint[]): Uint8Array
        F: {
            toObject(hash: Uint8Array): bigint
        }
    }

    export function buildPoseidon(): Promise<Poseidon>
}

declare module 'snarkjs' {
    export const groth16: {
        fullProve(
            input: Record<string, any>,
            wasmPath: string,
            zkeyPath: string
        ): Promise<{ proof: any; publicSignals: string[] }>

        verify(
            vkey: any,
            publicSignals: string[],
            proof: any
        ): Promise<boolean>

        exportSolidityCallData(
            proof: any,
            publicSignals: string[]
        ): Promise<string>
    }
}
