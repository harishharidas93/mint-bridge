/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import mirrorNode from '@/utils/mirrorNode';
import { TokenType, PublicKey, AccountId, TokenCreateTransaction, TransactionId, Timestamp } from '@hashgraph/sdk';

const keys = [
  'adminKey',
  'supplyKey',
  'newSupplyKey',
  'enableInvalidateCertFeature',
  'enableFreezeUserFeature',
  'enablePauseFeature',
  'enableKycFeature',
];

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:8080',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

interface Collection {
  id: string;
  name: string;
  description: string;
  symbol: string;
  totalSupply: number;
  owner: string;
  createdAt: string;
  status: 'Active' | 'Paused' | 'Inactive';
  image?: string;
  metadata?: string;
}

// Mock collections data
const MOCK_COLLECTIONS: Collection[] = [
  {
    id: "0.0.1234567",
    name: "Genesis Collection",
    description: "First NFT collection on Hedera",
    symbol: "GEN",
    totalSupply: 100,
    owner: "0.0.6359539",
    createdAt: "2024-01-15T10:30:00Z",
    status: "Active"
  },
  {
    id: "0.0.1234568", 
    name: "Dragon Guardians",
    description: "Legendary dragon collection",
    symbol: "DRG",
    totalSupply: 50,
    owner: "0.0.6359539",
    createdAt: "2024-01-18T16:45:00Z",
    status: "Active"
  },
  {
    id: "0.0.1234569",
    name: "Crystal Series",
    description: "Mystical crystal energy collection",
    symbol: "CRY",
    totalSupply: 25,
    owner: "0.0.6359539",
    createdAt: "2024-01-20T12:00:00Z",
    status: "Active"
  }
];

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// GET - Fetch collections
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Filter collections by wallet address (owner)
    const userCollections = [{ id: '0.0.6381137', name: 'Ad' }];
    // const userCollections = await mirrorNode.fetchTokenInfo(walletAddress); // Adjust as needed to fetch collections

    return NextResponse.json(userCollections, { headers: corsHeaders });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PUT - Create collection
export async function PUT(request: NextRequest) {
  try {
    // Parse FormData instead of JSON
    const formData = await request.formData();
    
    const payload = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      walletAddress: formData.get('walletAddress') as string,
      timestamp: formData.get('timestamp') as string,
    };

    if (!payload.name || !payload.walletAddress) {
      return NextResponse.json(
        { error: 'name and walletAddress are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const symbol = payload.name.substring(0, 3).toUpperCase();
    const initialSupply = 0;
    const tokenType = TokenType.NonFungibleUnique;

    const collectionValidKeys: any = {};
    const privateKeys: any = {};

    const pubKey = await mirrorNode.fetchAccountInfo(payload.walletAddress);
    if (!pubKey.key?.key) {
      return NextResponse.json({
        error: 'Internal Server error, not able to get public key from account details',
      }, { status: 500, headers: corsHeaders });
    }
    
    const accountKey = PublicKey.fromString(pubKey.key.key);
    keys.forEach((key) => {
        privateKeys[key] = {
            publicKey: accountKey,
            pvtKeyString: accountKey.toStringRaw(),
        };
    });

    const ninetyDaysSeconds = 60 * 60 * 24 * 90;
    const secondsNow = Math.round(Date.now() / 1000);
    const timestamp = secondsNow + ninetyDaysSeconds;
    const timestampObj = new Timestamp(timestamp, 0);
    const tokenCreate = new TokenCreateTransaction();
    const memo = payload.description ? payload.description.substring(0, 100) : `${payload.name} by ${payload.walletAddress}`;
    
    tokenCreate
        .setMaxTransactionFee(30)
        .setTokenName(payload.name)
        .setTokenSymbol(symbol)
        .setTokenType(tokenType)
        .setInitialSupply(initialSupply)
        .setTreasuryAccountId(payload.walletAddress)
        .setTokenMemo(memo)
        .setSupplyKey(privateKeys.supplyKey.publicKey)
        .setExpirationTime(timestampObj);

    collectionValidKeys.supplyKey = privateKeys.supplyKey.pvtKeyString;
    collectionValidKeys.newSupplyKey = privateKeys.newSupplyKey.pvtKeyString;

    tokenCreate.setWipeKey(privateKeys.enableInvalidateCertFeature.publicKey);
    tokenCreate.setAdminKey(privateKeys.adminKey.publicKey);
    tokenCreate.setKycKey(privateKeys.enableKycFeature.publicKey);
    tokenCreate.setFreezeKey(privateKeys.enableFreezeUserFeature.publicKey);
    tokenCreate.setPauseKey(privateKeys.enablePauseFeature.publicKey);

    const transId = TransactionId.generate(payload.walletAddress);
    tokenCreate.setTransactionId(transId);
    tokenCreate.setNodeAccountIds([new AccountId(3)]);
    tokenCreate.freeze();
    
    return NextResponse.json({transaction: tokenCreate.toBytes()}, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Collection creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500, headers: corsHeaders }
    );
  }
}
