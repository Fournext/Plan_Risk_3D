export interface VerifyPlan {
    id: number;
    url: string;
}

export interface ResponseBlockchain {
    job_id: string;
    status: string;
    details: {
        image: {
            on_chain: string;
            local: string;
            valid: boolean;
        }
    }
}