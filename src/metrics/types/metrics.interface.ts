export interface ISite {
    url: string;
    visits: number;
}

export interface IMetrics {
    bandwidth_usage: string;
    top_sites: ISite[];
}